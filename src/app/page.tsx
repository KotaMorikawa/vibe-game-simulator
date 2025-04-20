"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import PreviewArea, { SceneObject } from "@/components/PreviewArea";

// メッセージの型定義
type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  // 状態管理
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "user", // assistantからuserに変更
      content: "3Dシーンについて案内してください",
    },
    {
      role: "assistant",
      content:
        "こんにちは！3Dシーンについて何か指示してください。例えば「赤い球と青い立方体を配置して」など。",
    },
  ]);
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([
    {
      id: "default-box",
      type: "box",
      color: "#2196f3",
      position: { x: 0, y: 0, z: 0 },
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComposing, setIsComposing] = useState<boolean>(false); // IME入力中かどうかを追跡
  const [debugText, setDebugText] = useState<string>(""); // デバッグ情報表示用

  // スクロールエリアの参照
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // シーンオブジェクトを強制的に更新する関数
  const updateSceneObjects = (objects: SceneObject[]) => {
    console.log("シーンオブジェクト更新:", objects);
    setDebugText(JSON.stringify(objects, null, 2));

    // ステート更新を確実に行う
    setSceneObjects([...objects]);
  };

  // シーンオブジェクトが変更されたときのログ
  useEffect(() => {
    console.log("シーンオブジェクトステート更新:", sceneObjects);
  }, [sceneObjects]);

  // メッセージが追加されたときに自動スクロール
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // JSONとテキストを分離する単純な関数（テキストのみを返す）
  const extractTextOnly = (text: string): string => {
    // 明らかなJSONパターンを削除
    let cleanedText = text;

    // APIからの生のテキストを返す（JSON解析なし）
    return cleanedText;
  };

  // テキストからマーカー文字列に囲まれたJSONを抽出する関数
  const extractJsonFromMarkers = (
    text: string
  ): { text: string; json: string | null } => {
    const startMarker = "SCENE_JSON_START";
    const endMarker = "SCENE_JSON_END";

    const startIndex = text.indexOf(startMarker);
    const endIndex = text.indexOf(endMarker);

    // マーカーが見つからない場合はそのまま返す
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return { text, json: null };
    }

    // マーカー間のJSONテキストを抽出
    const jsonText = text
      .substring(startIndex + startMarker.length, endIndex)
      .trim();

    // マーカーとJSON部分を除いたテキストを作成
    const cleanedText =
      text.substring(0, startIndex) +
      text.substring(endIndex + endMarker.length);

    return {
      text: cleanedText.trim(),
      json: jsonText,
    };
  };

  // メッセージ送信ハンドラー
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // 新しいメッセージを追加
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // 現在のメッセージ履歴を作成
      const messageHistory = [...messages, userMessage];

      // APIリクエスト
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: messageHistory }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      // SSEレスポンスのストリームを処理
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is null");
      }

      // AIの応答用の仮のメッセージを追加
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // ストリームからテキストをデコード
      const decoder = new TextDecoder();
      let aiResponseText = "";
      let bufferText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // テキストをデコードしバッファに追加
        const chunk = decoder.decode(value, { stream: true });
        bufferText += chunk;

        // イベントごとに分割（空行で区切られている）
        const events = bufferText.split("\n\n");

        // 最後のイベントが不完全な場合はバッファに残す
        bufferText = events.pop() || "";

        for (const event of events) {
          // JSON更新イベントの処理 - シーンオブジェクト専用
          if (event.includes("event: json_update")) {
            try {
              // データ部分を抽出 (event: json_update\ndata: {...})
              const dataMatch = event.match(/data: (.+)$/);
              if (dataMatch && dataMatch[1]) {
                const jsonData = dataMatch[1];

                // JSONをパース
                const objectData = JSON.parse(jsonData);

                // シーンオブジェクトが有効かどうかを確認
                if (Array.isArray(objectData) && objectData.length > 0) {
                  // シーンオブジェクトを更新（表示はしない）
                  updateSceneObjects(objectData);
                }
              }
            } catch (e) {
              console.error("JSON処理エラー:", e);
            }
          }
          // テキストチャンクの処理
          else if (event.startsWith("data: ")) {
            const text = event.replace("data: ", "");
            aiResponseText += text;

            // マーカー文字列を使ってJSONを抽出
            const { text: cleanedText, json } =
              extractJsonFromMarkers(aiResponseText);

            // テキストのみをメッセージに表示
            setMessages((prev) => {
              const updatedMessages = [...prev];
              updatedMessages[updatedMessages.length - 1].content = cleanedText;
              return updatedMessages;
            });

            // 抽出したJSONがあれば、シーンオブジェクトとして設定
            if (json) {
              try {
                const sceneData = JSON.parse(json);
                if (Array.isArray(sceneData) && sceneData.length > 0) {
                  updateSceneObjects(sceneData);
                }
              } catch (e) {
                console.error("マーカー間JSON解析エラー:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "エラーが発生しました。もう一度お試しください。",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Enterキーでメッセージを送信 - IME入力中は無視
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden p-4 gap-4">
      {/* チャット領域 */}
      <div className="flex flex-col w-full lg:w-1/2 gap-4 h-full overflow-hidden">
        <Card className="flex-1 p-4 flex flex-col overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden">
            <h2 className="text-xl font-bold mb-4">AI Chat</h2>

            {/* メッセージ表示領域 - 入力欄の高さが動的に変わっても対応できるように調整 */}
            <ScrollArea
              className="flex-1 overflow-auto"
              style={{ height: "calc(100% - 80px)" }}
              ref={scrollAreaRef}
            >
              <div className="flex flex-col gap-4 p-2 pb-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`${
                      message.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "mr-auto bg-muted"
                    } p-3 rounded-lg max-w-[80%]`}
                  >
                    {message.role === "assistant" ? (
                      <div className="whitespace-pre-wrap break-words">
                        {/* 複雑なJSON解析を行わず、テキストをそのまま表示 */}
                        {message.content}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="mr-auto bg-muted p-3 rounded-lg">
                    <p>考え中...</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* 入力フォーム - 内容に応じて縦に伸びるように修正 */}
            <div className="flex mt-auto">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="メッセージを入力..."
                disabled={isLoading}
                className="flex-1 p-2 border rounded min-h-[40px] max-h-[200px] resize-none"
                rows={1}
                style={{
                  height: "auto",
                  overflow: "hidden",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* プレビュー領域 */}
      <div className="w-full lg:w-1/2 h-full overflow-hidden">
        <Card className="p-4 h-full overflow-auto relative">
          <h2 className="text-xl font-bold mb-4">プレビュー</h2>

          {/* 現在のモデルJSONデータ表示ボタン */}
          <div className="mb-4">
            <details>
              <summary className="font-semibold cursor-pointer">
                現在のモデルデータ
              </summary>
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs whitespace-pre-wrap overflow-auto max-h-[200px]">
                <pre>{JSON.stringify(sceneObjects, null, 2)}</pre>
              </div>
              <button
                className="mt-2 text-xs px-2 py-1 bg-blue-500 text-white rounded"
                onClick={() => {
                  // クリップボードにコピー
                  navigator.clipboard
                    .writeText(JSON.stringify(sceneObjects, null, 2))
                    .then(() =>
                      alert("JSONデータをクリップボードにコピーしました")
                    )
                    .catch((err) =>
                      console.error("コピーに失敗しました:", err)
                    );
                }}
              >
                JSONデータをコピー
              </button>
            </details>
          </div>

          <div className="h-[50vh] md:h-[60vh] relative">
            {/* ローディングオーバーレイ */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10 backdrop-blur-sm">
                <div className="bg-white/90 p-4 rounded-lg shadow-lg text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="font-medium">シーンを更新中...</p>
                </div>
              </div>
            )}
            <PreviewArea
              objects={sceneObjects}
              onObjectClick={(id) =>
                console.log(`オブジェクトがクリックされました: ${id}`)
              }
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
