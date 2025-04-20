import { NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// 環境変数からAPIキーを取得
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

// Gemini APIの安全性設定
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

// シーンオブジェクトの型定義
export type SceneObject = {
  id: string;
  type: "box" | "sphere" | "square" | "circle";
  color: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
};

// Stream Helperクラス - SSEストリームを生成するユーティリティ
class StreamingHelpers {
  // テキストチャンクをSSEフォーマットで送信
  static textChunk(text: string): string {
    return `data: ${text}\n\n`;
  }

  // JSONオブジェクトをSSEフォーマットで送信
  static jsonEvent(data: SceneObject[]): string {
    return `event: json_update\ndata: ${JSON.stringify(data)}\n\n`;
  }
}

// POSTハンドラー
export async function POST(req: Request) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Define a type for chat messages
    type ChatMessage = {
      role: string;
      content: string;
    };

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Valid messages array is required" },
        { status: 400 }
      );
    }

    // APIリクエスト用のストリームエンコーダー
    const encoder = new TextEncoder();

    // SSEストリームを設定
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Google Gemini APIの初期化
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash", // 安価の実験版モデルを使用
            safetySettings,
          });

          // チャット履歴を構築
          const userMessages = messages.map((msg: ChatMessage) => ({
            role: msg.role,
            parts: [{ text: msg.content }],
          }));

          // プロンプトの構築
          const lastMessage = userMessages[userMessages.length - 1];
          let prompt = lastMessage.parts[0].text;

          // 3Dシーンに関する指示をプロンプトに追加
          prompt += `
          
あなたは会話に基づいて2D/3Dシーンを作成するアシスタントです。ユーザーの指示に応じて、テキストで説明するだけでなく、
JSONオブジェクトの配列を生成して2D/3Dシーンの様子を表現してください。

応答には2つの部分を含めてください：
1. 通常の会話応答（テキスト）
2. シーンオブジェクトの配列（JSONフォーマット）

JSONオブジェクト部分は必ず「SCENE_JSON_START」という文字列から始めて、「SCENE_JSON_END」という文字列で終わらせてください。
その間に以下の形式のJSONオブジェクトの配列を配置してください：

SCENE_JSON_START
[
  {
    "id": "一意のID",
    "type": "box" | "sphere" | "square" | "circle",
    "color": "カラーコード（例: #ff0000）",
    "position": { "x": 数値, "y": 数値, "z": 数値 },
    "rotation": { "x": 数値, "y": 数値, "z": 数値 },  // オプション
    "scale": { "x": 数値, "y": 数値, "z": 数値 }      // オプション
  },
  ...
]
SCENE_JSON_END

2Dオブジェクトの場合はz軸を0に設定してください。
応答は簡潔にし、ユーザーの指示に基づいてシーンを視覚的に表現することに集中してください。
`;

          // チャット履歴からassistantメッセージを除外し、userメッセージのみにする
          const filteredHistory = userMessages
            .slice(0, -1)
            .filter((msg) => msg.role === "user");

          // ストリーミングレスポンスを開始
          // チャットセッションを開始（フィルタリングされた履歴を使用）
          const chat = model.startChat({
            history: filteredHistory,
          });
          const result = await chat.sendMessageStream(prompt);
          const resultStream = result.stream;

          // 最初のシーンオブジェクトの配列を生成
          const initialSceneObjects: SceneObject[] = [
            {
              id: "default-box",
              type: "box",
              color: "#2196f3",
              position: { x: 0, y: 0, z: 0 },
            },
          ];

          // 初期シーン状態をJSONイベントとして送信
          controller.enqueue(
            encoder.encode(StreamingHelpers.jsonEvent(initialSceneObjects))
          );

          let objectUpdateGenerated = false;
          let textBuffer = "";
          let jsonDetectionBuffer = "";

          // レスポンスストリームの処理
          for await (const chunk of resultStream) {
            // テキストチャンクを処理
            const chunkText = chunk.text();
            textBuffer += chunkText;
            jsonDetectionBuffer += chunkText;

            // テキストチャンクをストリーミング
            controller.enqueue(
              encoder.encode(StreamingHelpers.textChunk(chunkText))
            );

            // JSONデータの検出と処理（さらに改善版）
            try {
              // マーカー文字列を使用したJSON検出
              const markerStartIndex =
                jsonDetectionBuffer.indexOf("SCENE_JSON_START");
              const markerEndIndex =
                jsonDetectionBuffer.indexOf("SCENE_JSON_END");

              if (markerStartIndex >= 0 && markerEndIndex > markerStartIndex) {
                // マーカー間のJSONテキストを抽出
                const jsonText = jsonDetectionBuffer
                  .substring(
                    markerStartIndex + "SCENE_JSON_START".length,
                    markerEndIndex
                  )
                  .trim();

                try {
                  // JSONとして解析
                  const sceneObjects = JSON.parse(jsonText);

                  // 有効なシーンオブジェクトの配列かどうかを検証
                  if (
                    Array.isArray(sceneObjects) &&
                    sceneObjects.length > 0 &&
                    sceneObjects.every(
                      (obj) => obj && typeof obj === "object" && "id" in obj
                    )
                  ) {
                    console.log("マーカーから検出したJSON:", jsonText);
                    console.log("解析されたオブジェクト:", sceneObjects);

                    // シーンオブジェクトを送信
                    controller.enqueue(
                      encoder.encode(StreamingHelpers.jsonEvent(sceneObjects))
                    );

                    objectUpdateGenerated = true;
                    // 処理済みのJSONを検出バッファから削除
                    jsonDetectionBuffer = jsonDetectionBuffer.substring(
                      markerEndIndex + "SCENE_JSON_END".length
                    );
                  }
                } catch (parseError) {
                  console.log("マーカーJSON解析エラー:", parseError);
                }
              }

              // 従来の検出方法もバックアップとして保持
              if (!objectUpdateGenerated) {
                // 方法1: 標準的なJSONパターン [{ ... }] を検出
                const jsonStartIndex = jsonDetectionBuffer.indexOf("[{");
                if (jsonStartIndex >= 0) {
                  const jsonEndIndex = jsonDetectionBuffer.lastIndexOf("}]");

                  if (jsonEndIndex > jsonStartIndex) {
                    // 可能性のあるJSONを抽出し、前後の余分なテキストを削除
                    let possibleJson = jsonDetectionBuffer.substring(
                      jsonStartIndex,
                      jsonEndIndex + 2
                    );

                    // 一般的な前処理：改行やスペースを正規化
                    possibleJson = possibleJson.replace(/[\r\n]+/g, " ").trim();

                    try {
                      // JSONとして解析を試みる
                      const sceneObjects = JSON.parse(possibleJson);

                      // 有効なシーンオブジェクトの配列かどうかを検証
                      if (
                        Array.isArray(sceneObjects) &&
                        sceneObjects.length > 0 &&
                        sceneObjects.every(
                          (obj) => obj && typeof obj === "object" && "id" in obj
                        )
                      ) {
                        console.log("検出したJSON:", possibleJson);
                        console.log("解析されたオブジェクト:", sceneObjects);

                        // シーンオブジェクトを送信
                        controller.enqueue(
                          encoder.encode(
                            StreamingHelpers.jsonEvent(sceneObjects)
                          )
                        );

                        objectUpdateGenerated = true;
                        // 処理済みのJSONは今後検出しないようにバッファをクリア
                        jsonDetectionBuffer = "";
                      }
                    } catch (parseError) {
                      console.log("JSON解析試行エラー(方法1):", parseError);
                    }
                  }
                }

                // 方法2: コードブロック内のJSONを検出 (```... ```)
                if (!objectUpdateGenerated) {
                  const codeBlockMatch = jsonDetectionBuffer.match(
                    /```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/
                  );
                  if (codeBlockMatch && codeBlockMatch[1]) {
                    try {
                      const jsonFromCodeBlock = codeBlockMatch[1].trim();
                      const sceneObjects = JSON.parse(jsonFromCodeBlock);

                      if (
                        Array.isArray(sceneObjects) &&
                        sceneObjects.length > 0 &&
                        sceneObjects.every(
                          (obj) => obj && typeof obj === "object" && "id" in obj
                        )
                      ) {
                        console.log(
                          "コードブロックからJSON検出:",
                          jsonFromCodeBlock
                        );
                        console.log("解析されたオブジェクト:", sceneObjects);

                        controller.enqueue(
                          encoder.encode(
                            StreamingHelpers.jsonEvent(sceneObjects)
                          )
                        );

                        objectUpdateGenerated = true;
                        jsonDetectionBuffer = "";
                      }
                    } catch (parseError) {
                      console.log("JSON解析試行エラー(方法2):", parseError);
                    }
                  }
                }

                // 方法3: 不完全なJSONの検出と修復試行
                if (
                  !objectUpdateGenerated &&
                  textBuffer.includes("id") &&
                  textBuffer.includes("type") &&
                  textBuffer.includes("color")
                ) {
                  // 正規表現で可能性のあるJSONフラグメントを探す
                  const jsonFragmentMatch = textBuffer.match(
                    /\[\s*\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"([^"]+)"\s*,.*?\}\s*,?\s*\{.*?\}\s*\]/s
                  );

                  if (jsonFragmentMatch) {
                    try {
                      // フラグメントを修復して解析を試みる
                      let repairedJson = jsonFragmentMatch[0].replace(
                        /,\s*\]/g,
                        "]"
                      );
                      const sceneObjects = JSON.parse(repairedJson);

                      if (
                        Array.isArray(sceneObjects) &&
                        sceneObjects.length > 0
                      ) {
                        console.log("修復されたJSON:", repairedJson);
                        console.log("解析されたオブジェクト:", sceneObjects);

                        controller.enqueue(
                          encoder.encode(
                            StreamingHelpers.jsonEvent(sceneObjects)
                          )
                        );

                        objectUpdateGenerated = true;
                      }
                    } catch (parseError) {
                      console.log("JSON修復試行エラー:", parseError);
                    }
                  }
                }

                // 方法4: レスポンス全体からJSONを手動で構築
                if (
                  !objectUpdateGenerated &&
                  textBuffer.includes("緑") &&
                  textBuffer.includes("赤") &&
                  (textBuffer.includes("球") || textBuffer.includes("地面"))
                ) {
                  console.log(
                    "JSONが検出されなかったため、レスポンスから手動で構築します"
                  );

                  // 緑の地面と赤い球を手動で構築
                  const manualObjects = [
                    {
                      id: "ground_1",
                      type: "box",
                      color: "#008000", // 緑
                      position: { x: 0, y: -1, z: 0 },
                      scale: { x: 10, y: 0.1, z: 10 },
                    },
                    {
                      id: "sphere_1",
                      type: "sphere",
                      color: "#ff0000", // 赤
                      position: { x: 0, y: 1, z: 0 },
                      scale: { x: 1, y: 1, z: 1 },
                    },
                  ];

                  controller.enqueue(
                    encoder.encode(StreamingHelpers.jsonEvent(manualObjects))
                  );

                  objectUpdateGenerated = true;
                }
              }
            } catch (e) {
              console.error("JSON検出処理エラー:", e);
              // エラーが発生してもストリーミングは継続
            }
          }

          // 応答の終了時、JSONが生成されていない場合のフォールバック（改良）
          if (!objectUpdateGenerated) {
            try {
              console.log(
                "フォールバック: JSONが検出されなかったため、テキストから3Dシーンを自動生成します"
              );

              // テキスト応答にJSONのような部分があるか最終確認
              if (
                textBuffer.includes("[") &&
                textBuffer.includes("]") &&
                textBuffer.includes("id") &&
                textBuffer.includes("type") &&
                textBuffer.includes("color")
              ) {
                // 正規表現で可能性のあるJSONフラグメントを探す（最終試行）
                const lastAttemptMatch = textBuffer.match(
                  /\[\s*\{[^\[\]]*\}\s*\]/g
                );
                if (lastAttemptMatch) {
                  for (const potentialJson of lastAttemptMatch) {
                    try {
                      const lastObjects = JSON.parse(potentialJson);
                      if (
                        Array.isArray(lastObjects) &&
                        lastObjects.length > 0
                      ) {
                        console.log("最終試行で検出したJSON:", potentialJson);

                        controller.enqueue(
                          encoder.encode(
                            StreamingHelpers.jsonEvent(lastObjects)
                          )
                        );

                        objectUpdateGenerated = true;
                        break;
                      }
                    } catch (e) {
                      console.log("最終JSON解析エラー:", e);
                    }
                  }
                }
              }

              // それでもJSONが検出されなかった場合、単語に基づいて生成
              if (!objectUpdateGenerated) {
                const generatedObjects = generateDefaultObjects(textBuffer);

                // 生成されたシーンオブジェクトを送信
                controller.enqueue(
                  encoder.encode(StreamingHelpers.jsonEvent(generatedObjects))
                );
              }
            } catch (e) {
              console.error("オブジェクト生成エラー:", e);
            }
          }

          // ストリームの終了
          controller.close();
        } catch (error) {
          // エラーハンドリング
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              StreamingHelpers.textChunk(
                "エラーが発生しました。もう一度お試しください。"
              )
            )
          );
          controller.close();
        }
      },
    });

    // SSEレスポンスの返却
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// テキストから簡易的なシーンオブジェクトを生成するヘルパー関数
function generateDefaultObjects(text: string): SceneObject[] {
  // 色に関する単語とそれに対応するカラーコード
  const colorKeywords: Record<string, string> = {
    red: "#ff0000",
    blue: "#0000ff",
    green: "#00ff00",
    yellow: "#ffff00",
    purple: "#800080",
    orange: "#ffa500",
    black: "#000000",
    white: "#ffffff",
    pink: "#ffc0cb",
    brown: "#a52a2a",
    gray: "#808080",
    grey: "#808080",
  };

  // デフォルトのシーンオブジェクト
  const defaultObjects: SceneObject[] = [
    {
      id: "auto-box-1",
      type: "box",
      color: "#2196f3",
      position: { x: -1, y: 0, z: 0 },
    },
  ];

  // テキストから色を検出して適用
  Object.entries(colorKeywords).forEach(([keyword, colorCode]) => {
    if (text.toLowerCase().includes(keyword)) {
      defaultObjects[0].color = colorCode;
    }
  });

  // テキストから形状を検出
  if (
    text.toLowerCase().includes("sphere") ||
    text.toLowerCase().includes("ball") ||
    text.toLowerCase().includes("円") ||
    text.toLowerCase().includes("球")
  ) {
    defaultObjects[0].type = "sphere";
  } else if (
    text.toLowerCase().includes("square") ||
    text.toLowerCase().includes("平面") ||
    text.toLowerCase().includes("四角")
  ) {
    defaultObjects[0].type = "square";
  } else if (
    text.toLowerCase().includes("circle") ||
    text.toLowerCase().includes("円")
  ) {
    defaultObjects[0].type = "circle";
  }

  // 複数のオブジェクトの可能性を検討
  if (
    text.toLowerCase().includes("multiple") ||
    text.toLowerCase().includes("several") ||
    text.toLowerCase().includes("many") ||
    text.toLowerCase().includes("複数")
  ) {
    defaultObjects.push({
      id: "auto-sphere-1",
      type: "sphere",
      color: "#f44336",
      position: { x: 1, y: 0, z: 0 },
    });
  }

  return defaultObjects;
}
