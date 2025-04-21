import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { submitQuestion, extractSceneData } from "@/lib/langgraph";
import {
  StreamMessageType,
  SSE_DATA_PREFIX,
  SSE_LINE_DELIMITER,
  StreamMessage,
  SceneObject,
} from "@/lib/types";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// 環境変数からAPIキーを取得
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// Convexクライアントの初期化
const convex = new ConvexHttpClient(convexUrl || "");

// POSTハンドラー
export async function POST(req: Request) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  if (!convexUrl) {
    return NextResponse.json(
      { error: "Convex URL not configured" },
      { status: 500 }
    );
  }

  try {
    // リクエストからデータを取得
    const { messages, chatId: existingChatId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Valid messages array is required" },
        { status: 400 }
      );
    }

    // チャットIDの取得または新規作成
    const chatId = await getOrCreateChatId(existingChatId, messages);

    // 最新のユーザーメッセージを保存
    const lastUserMessage = messages[messages.length - 1];
    await convex.mutation(api.messages.sendMessage, {
      chatId,
      content: lastUserMessage.content,
    });

    // ストリーム設定とレスポンス生成
    return createStreamResponse(messages, chatId);
  } catch (error) {
    console.error("Request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
// チャットIDを取得または新規作成する関数
async function getOrCreateChatId(
  existingChatId: string | undefined,
  messages: any[]
): Promise<Id<"chats">> {
  let chatId: Id<"chats"> | undefined = existingChatId
    ? ({ __id: existingChatId, __tableName: "chats" } as Id<"chats">)
    : undefined;
  let chatId = existingChatId;

  if (!chatId) {
    // 新しいチャットを作成
    const title = messages[0].content.substring(0, 50) + "...";
    chatId = await convex.mutation(api.chats.createChat, { title });

    // 過去のメッセージをすべて保存（あれば）
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      await convex.mutation(api.messages.sendMessage, {
        chatId,
        content: msg.content,
      });
    }
  }

  return chatId;
}

// ストリームレスポンスを作成する関数
async function createStreamResponse(messages: any[], chatId: string) {
  // ストリームの設定
  const stream = new TransformStream({}, { highWaterMark: 1024 });
  const writer = stream.writable.getWriter();

  const startStream = async () => {
    try {
      // 接続確立メッセージを送信
      await sendSSEMessage(writer, { type: StreamMessageType.Connected });

      // 初期シーンオブジェクトの配列を生成
      const initialSceneObjects: SceneObject[] = [
        {
          id: "default-box",
          type: "box",
          color: "#2196f3",
          position: { x: 0, y: 0, z: 0 },
        },
      ];

      // 初期シーンデータを送信
      await sendSSEMessage(writer, {
        type: StreamMessageType.SceneData,
        data: initialSceneObjects,
      });

      // メッセージをLangChainフォーマットに変換
      type ChatMessage = {
        role: string;
        content: string;
      };

      const langChainMessages = messages.map((msg: ChatMessage) =>
        msg.role === "user"
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content)
      );

      // LangGraphワークフローの実行
      try {
        await processAIResponse(langChainMessages, chatId, writer);
      } catch (streamError) {
        console.error("Stream processing error:", streamError);
        await sendSSEMessage(writer, {
          type: StreamMessageType.Error,
          error:
            streamError instanceof Error
              ? streamError.message
              : "Stream processing failed",
        });
      }
    } catch (error) {
      console.error("General error:", error);
      await sendSSEMessage(writer, {
        type: StreamMessageType.Error,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      try {
        await writer.close();
      } catch (closeError) {
        console.error("Error closing writer:", closeError);
      }
    }
  };

  // ストリーム処理を開始
  startStream();

  // SSEレスポンスの返却
  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// AIレスポンスを処理する関数
async function processAIResponse(
  langChainMessages: any[],
  chatId: string,
  writer: WritableStreamDefaultWriter<Uint8Array>
) {
  const eventStream = await submitQuestion(langChainMessages, chatId, apiKey!);

  let fullResponse = "";
  let sceneData = null;

  // イベントの処理
  for await (const event of eventStream) {
    if (event.event === "on_chat_model_stream") {
      await processTokenEvent(event, writer, fullResponse);

      // トークンを取得してフルレスポンスに追加
      const token = event.data.chunk;
      if (token) {
        let text = extractTextFromToken(token);
        if (text) {
          fullResponse += text;
        }
      }
    } else if (event.event === "on_values") {
      // 状態値のイベント（メッセージなど）を処理
      const result = await processValuesEvent(event, writer);
      if (result.sceneData) {
        sceneData = result.sceneData;
      }
    }
  }

  // シーンデータが抽出できなかった場合のフォールバック
  if (!sceneData && fullResponse) {
    const fallbackResult = await processFallbackSceneData(fullResponse, writer);
    sceneData = fallbackResult.sceneData;
  }

  // sceneDataがまだnullの場合は、空の配列をJSON文字列化して設定
  if (sceneData === null) {
    sceneData = JSON.stringify([]);
  }

  // AI応答をDatabaseに保存
  await convex.mutation(api.messages.storeAIMessage, {
    chatId,
    content: fullResponse,
    sceneData: sceneData,
  });

  // 完了メッセージを送信
  await sendSSEMessage(writer, {
    type: StreamMessageType.Done,
  });
}

// トークンイベントを処理する関数
async function processTokenEvent(
  event: any,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  fullResponse: string
) {
  const token = event.data.chunk;
  if (token) {
    // AIMessageChunkからテキストを取得
    const text = extractTextFromToken(token);

    if (text) {
      await sendSSEMessage(writer, {
        type: StreamMessageType.Token,
        token: text,
      });
    }
  }
}

// トークンからテキストを抽出する関数
function extractTextFromToken(token: any) {
  let text;

  // 配列形式のcontentの場合
  if (Array.isArray(token.content) && token.content.length > 0) {
    const content = token.content[0];
    text =
      typeof content === "object" && "text" in content ? content.text : content;
  }
  // 文字列形式のcontentの場合
  else if (typeof token.content === "string") {
    text = token.content;
  }

  return text;
}

// 状態値イベントを処理する関数
async function processValuesEvent(
  event: any,
  writer: WritableStreamDefaultWriter<Uint8Array>
) {
  let sceneData = null;

  if (
    event.data &&
    "messages" in event.data &&
    Array.isArray(event.data.messages) &&
    event.data.messages.length > 0
  ) {
    const aiMessage = event.data.messages[0];

    // シーンデータがあれば抽出
    if (aiMessage.additional_kwargs?.scene_data) {
      // メタデータからシーンデータを取得
      sceneData = aiMessage.additional_kwargs.scene_data;

      try {
        // シーンデータのパース処理
        const parsedData = JSON.parse(sceneData);
        const sceneObjects = processSceneData(parsedData);

        if (sceneObjects.length > 0) {
          // シーンオブジェクトをクライアントに送信
          await sendSSEMessage(writer, {
            type: StreamMessageType.SceneData,
            data: sceneObjects,
          });
        }
      } catch (e) {
        console.error("シーンデータJSONの解析エラー:", e);
      }
    }
  }

  return { sceneData };
}

// フォールバックシーンデータを処理する関数
async function processFallbackSceneData(
  fullResponse: string,
  writer: WritableStreamDefaultWriter<Uint8Array>
) {
  let sceneData = null;

  // コンテンツからシーンデータを抽出する試み
  const extractedSceneData = extractSceneData(fullResponse);
  if (extractedSceneData) {
    sceneData = extractedSceneData;
    try {
      const parsedData = JSON.parse(extractedSceneData);
      // 上記と同様の処理を行う
      const sceneObjects = processSceneData(parsedData);

      if (sceneObjects.length > 0) {
        await sendSSEMessage(writer, {
          type: StreamMessageType.SceneData,
          data: sceneObjects,
        });
      }
    } catch (e) {
      console.error("抽出したシーンデータの解析エラー:", e);
    }
  } else {
    // フォールバックシーンオブジェクトを生成
    const fallbackSceneObjects = generateDefaultObjects(fullResponse);
    await sendSSEMessage(writer, {
      type: StreamMessageType.SceneData,
      data: fallbackSceneObjects,
    });

    // フォールバックシーンデータをJSON文字列として保存用に設定
    sceneData = JSON.stringify(fallbackSceneObjects);
  }

  return { sceneData };
}

// SSEメッセージを送信するユーティリティ関数
const sendSSEMessage = async (
  writer: WritableStreamDefaultWriter<Uint8Array>,
  data: StreamMessage
) => {
  const encoder = new TextEncoder();
  return writer.write(
    encoder.encode(
      `${SSE_DATA_PREFIX}${JSON.stringify(data)}${SSE_LINE_DELIMITER}`
    )
  );
};

// オブジェクトタイプを適切な形式に変換するヘルパー関数
function mapObjectType(
  type: string | undefined
): "box" | "sphere" | "square" | "circle" {
  if (!type) return "box";

  type = type.toLowerCase();

  if (type.includes("sphere") || type.includes("ball") || type.includes("球")) {
    return "sphere";
  } else if (
    type.includes("square") ||
    type.includes("平面") ||
    type.includes("四角")
  ) {
    return "square";
  } else if (type.includes("circle") || type.includes("円")) {
    return "circle";
  } else if (type.includes("plane")) {
    // 平面タイプはboxとして処理
    return "box";
  } else {
    return "box";
  }
}

// 入力データの型定義
interface SceneObjectInput {
  id?: string;
  type?: string;
  color?: string;
  position?: { x?: number; y?: number; z?: number } | number[];
  rotation?: { x?: number; y?: number; z?: number } | number[];
  scale?: { x?: number; y?: number; z?: number } | number[];
}

interface SceneDataWithObjects {
  scene: {
    objects: SceneObjectInput[];
  };
}

type SceneDataInput = SceneDataWithObjects | SceneObjectInput[];

// Type guard to check if data is SceneDataWithObjects
function isSceneDataWithObjects(
  data: SceneDataInput
): data is SceneDataWithObjects {
  return data && typeof data === "object" && "scene" in data;
}

// シーンデータを処理するヘルパー関数
function processSceneData(data: SceneDataInput): SceneObject[] {
  let sceneObjects: SceneObject[] = [];
  let hasGround = false;

  if (isSceneDataWithObjects(data) && Array.isArray(data.scene.objects)) {
    // scene.objects構造の場合
    sceneObjects = data.scene.objects.map(
      (obj: SceneObjectInput, index: number) => {
        // 地面（プレーン）の存在をチェック
        if (obj.type && obj.type.toLowerCase().includes("plane")) {
          hasGround = true;
        }

        return {
          id: obj.id || `object-${index}`,
          type: mapObjectType(obj.type),
          color: obj.color || "#2196f3",
          position: {
            x: Array.isArray(obj.position)
              ? obj.position[0]
              : obj.position?.x || 0,
            y: Array.isArray(obj.position)
              ? obj.position[1]
              : obj.position?.y || 0,
            z: Array.isArray(obj.position)
              ? obj.position[2]
              : obj.position?.z || 0,
          },
          rotation: obj.rotation
            ? {
                x: Array.isArray(obj.rotation)
                  ? obj.rotation[0]
                  : obj.rotation?.x || 0,
                y: Array.isArray(obj.rotation)
                  ? obj.rotation[1]
                  : obj.rotation?.y || 0,
                z: Array.isArray(obj.rotation)
                  ? obj.rotation[2]
                  : obj.rotation?.z || 0,
              }
            : undefined,
          scale: obj.scale
            ? {
                x: Array.isArray(obj.scale) ? obj.scale[0] : obj.scale?.x || 1,
                y: Array.isArray(obj.scale) ? obj.scale[1] : obj.scale?.y || 1,
                z: Array.isArray(obj.scale) ? obj.scale[2] : obj.scale?.z || 1,
              }
            : undefined,
        };
      }
    );
  } else if (Array.isArray(data)) {
    // すでに配列形式の場合
    sceneObjects = data.map((obj: SceneObjectInput, index: number) => {
      // 地面の存在をチェック
      if (obj.type && obj.type.toLowerCase().includes("plane")) {
        hasGround = true;
      }

      return {
        id: obj.id || `object-${index}`,
        type: mapObjectType(obj.type),
        color: obj.color || "#2196f3",
        position: {
          x: Array.isArray(obj.position)
            ? obj.position[0]
            : obj.position?.x || 0,
          y: Array.isArray(obj.position)
            ? obj.position[1]
            : obj.position?.y || 0,
          z: Array.isArray(obj.position)
            ? obj.position[2]
            : obj.position?.z || 0,
        },
        rotation: obj.rotation
          ? {
              x: Array.isArray(obj.rotation)
                ? obj.rotation[0]
                : obj.rotation?.x || 0,
              y: Array.isArray(obj.rotation)
                ? obj.rotation[1]
                : obj.rotation?.y || 0,
              z: Array.isArray(obj.rotation)
                ? obj.rotation[2]
                : obj.rotation?.z || 0,
            }
          : undefined,
        scale: obj.scale
          ? {
              x: Array.isArray(obj.scale) ? obj.scale[0] : obj.scale?.x || 1,
              y: Array.isArray(obj.scale) ? obj.scale[1] : obj.scale?.y || 1,
              z: Array.isArray(obj.scale) ? obj.scale[2] : obj.scale?.z || 1,
            }
          : undefined,
      };
    });
  }

  // 地面が存在しない場合のみ追加
  if (!hasGround) {
    sceneObjects.push({
      id: "ground",
      type: "box",
      color: "#8bc34a",
      position: { x: 0, y: -2, z: 0 },
      scale: { x: 10, y: 0.1, z: 10 },
    });
  }

  return sceneObjects;
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
    赤: "#ff0000",
    青: "#0000ff",
    緑: "#00ff00",
    黄色: "#ffff00",
    紫: "#800080",
    オレンジ: "#ffa500",
    黒: "#000000",
    白: "#ffffff",
    ピンク: "#ffc0cb",
    茶色: "#a52a2a",
    灰色: "#808080",
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
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
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

  // 地面に関するチェック
  let groundColor = "#8bc34a"; // デフォルト緑色

  // 地面に関する記述があるか確認
  if (
    text.toLowerCase().includes("ground") ||
    text.toLowerCase().includes("floor") ||
    text.toLowerCase().includes("地面") ||
    text.toLowerCase().includes("床")
  ) {
    // 地面の色を検出
    Object.entries(colorKeywords).forEach(([keyword, colorCode]) => {
      const pattern = new RegExp(
        `(${keyword})(\\s+)?(ground|floor|地面|床)|(ground|floor|地面|床)(\\s+)?(${keyword})`,
        "i"
      );
      if (pattern.test(text.toLowerCase())) {
        groundColor = colorCode;
      }
    });
  }

  // 地面を追加
  defaultObjects.push({
    id: "ground",
    type: "box",
    color: groundColor,
    position: { x: 0, y: -2, z: 0 },
    scale: { x: 10, y: 0.1, z: 10 },
  });

  return defaultObjects;
}
