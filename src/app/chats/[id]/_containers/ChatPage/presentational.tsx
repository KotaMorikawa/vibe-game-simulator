"use client";

import React, { useState, useEffect } from "react";
import { Message } from "../../_components/MessageList";
import { SceneObject } from "@/components/PreviewArea";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import MessageList from "../../_components/MessageList";
import MessageInput from "../../_components/MessageInput";
import ScenePreview, { SceneDataViewer } from "../../_components/ScenePreview";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Chat } from "../../_lib/types";
import { api } from "../../../../../../convex/_generated/api";
import { convertSceneData } from "@/lib/scene";
import { getConvexClient } from "@/lib/convex";

interface ChatPageClientProps {
  chatId: Id<"chats">;
  initialChat: Chat;
  initialMessages: Message[];
}

export default function ChatPagePresentational({
  chatId,
  initialChat,
  initialMessages,
}: ChatPageClientProps) {
  // リアルタイム更新を使用せず、初期データを使用
  const [chat] = useState<Chat>(initialChat);
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);

  // 状態管理
  const [formattedMessages, setFormattedMessages] = useState<Message[]>([]);
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([
    {
      id: "default-box",
      type: "box",
      color: "#2196f3",
      position: { x: 0, y: 0, z: 0 },
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // チャットからシーンデータを直接取得
  useEffect(() => {
    if (chat && chat.sceneData) {
      try {
        const sceneData = JSON.parse(chat.sceneData);
        const convertedObjects = convertSceneData(sceneData);
        if (convertedObjects.length > 0) {
          setSceneObjects(convertedObjects);
        }
      } catch (e) {
        console.error("チャットのシーンデータ解析エラー:", e);
      }
    }
  }, [chat]);

  // メッセージが取得できたらフォーマットして表示用に変換
  useEffect(() => {
    if (messages && messages.length > 0) {
      const formatted: Message[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        _id: msg._id,
        chatId: msg.chatId,
        createdAt: msg.createdAt,
        sceneData: msg.sceneData,
      }));

      setFormattedMessages(formatted);

      // 最後のアシスタントメッセージからシーンデータを復元
      const lastAssistantMsg = [...formatted]
        .reverse()
        .find((m) => m.role === "assistant");

      if (lastAssistantMsg && lastAssistantMsg.sceneData) {
        try {
          const sceneData = JSON.parse(lastAssistantMsg.sceneData);
          const convertedObjects = convertSceneData(sceneData);
          if (convertedObjects.length > 0) {
            setSceneObjects(convertedObjects);
          }
        } catch (e) {
          console.error("保存されたシーンデータの解析エラー:", e);
        }
      }
    } else if (messages && messages.length === 0) {
      // 空のメッセージ配列を受け取った場合のみ、一度だけデフォルトメッセージを設定
      if (formattedMessages.length === 0) {
        setFormattedMessages([
          {
            role: "user",
            content: "3Dシーンについて案内してください",
          },
          {
            role: "assistant",
            content:
              "こんにちは！3Dシーンについて何か指示してください。例えば「赤い球と青い立方体を配置して」など。",
          },
        ]);
      }
    }
  }, [messages, formattedMessages.length]);

  // メッセージ送信ハンドラー
  const handleSendMessage = async (userMessage: Message) => {
    if (isLoading) return;

    // エラー状態をリセット
    setError(null);

    // 新しいユーザーメッセージを追加（楽観的更新）
    const newUserMessage = {
      ...userMessage,
      _id: `temp_${Date.now()}`,
      chatId,
      createdAt: Date.now(),
    };

    setFormattedMessages((prev) => [...prev, newUserMessage as Message]);
    setIsLoading(true);

    try {
      // AIの応答用の仮のメッセージを追加
      setFormattedMessages((prev) => [
        ...prev,
        { role: "assistant", content: "考え中..." },
      ]);

      // APIリクエスト
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: formattedMessages,
          newMessage: userMessage,
          chatId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      // SSEレスポンスのストリームを処理
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is null");
      }

      // ストリームからテキストをデコード
      const decoder = new TextDecoder();
      let aiResponseText = "";
      let bufferText = "";
      let completionData: { chatId: string; messageId: string } | null = null;
      let fullMessageData = null;

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
                  // シーンオブジェクトを更新
                  setSceneObjects([...objectData]);
                }
              }
            } catch (e) {
              console.error("JSON処理エラー:", e);
            }
          }
          // 完了イベントの処理
          else if (event.includes("event: completion")) {
            try {
              // データ部分を抽出 (event: completion\ndata: {...})
              const dataMatch = event.match(/data: (.+)$/);
              if (dataMatch && dataMatch[1]) {
                completionData = JSON.parse(dataMatch[1]);
                console.log("完了イベント:", completionData);
                fullMessageData = {
                  _id: completionData?.messageId || `temp_${Date.now()}`,
                  chatId,
                  content: aiResponseText,
                  role: "assistant",
                  createdAt: Date.now(),
                  sceneData: JSON.stringify(sceneObjects),
                };

                // 応答が完了したら、実際のメッセージをDBに保存
                try {
                  const convex = getConvexClient();
                  await convex.mutation(api.messages.storeAIMessage, {
                    chatId,
                    content: aiResponseText,
                    sceneData: JSON.stringify(sceneObjects),
                  });
                } catch (storeError) {
                  console.error("メッセージの保存エラー:", storeError);
                }
              }
            } catch (e) {
              console.error("完了イベント処理エラー:", e);
            }
          }
          // テキストチャンクの処理
          else if (event.startsWith("data: ")) {
            const text = event.replace("data: ", "");
            aiResponseText += text;

            // テキストのみをメッセージに表示
            setFormattedMessages((prev) => {
              const updatedMessages = [...prev];
              updatedMessages[updatedMessages.length - 1].content =
                aiResponseText;
              return updatedMessages;
            });
          }
        }
      }

      // 応答が完了した後、メッセージ配列を更新（楽観的更新から確定版に）
      if (fullMessageData) {
        setMessages((prev) => [...prev, fullMessageData as Message]);

        // ユーザーメッセージも保存（APIがユーザーメッセージを保存しない場合）
        try {
          const convex = getConvexClient();
          await convex.mutation(api.messages.sendMessage, {
            chatId,
            content: userMessage.content,
          });
        } catch (error) {
          console.error("ユーザーメッセージの保存エラー:", error);
        }
      }
    } catch (error) {
      console.error("メッセージ送信エラー:", error);

      // エラーメッセージを表示
      setError(
        error instanceof Error ? error.message : "不明なエラーが発生しました"
      );

      // エラーメッセージを表示
      setFormattedMessages((prev) => {
        const updatedMessages = [...prev];
        if (updatedMessages[updatedMessages.length - 1].role === "assistant") {
          updatedMessages[updatedMessages.length - 1].content =
            "エラーが発生しました。もう一度お試しください。";
        } else {
          updatedMessages.push({
            role: "assistant",
            content: "エラーが発生しました。もう一度お試しください。",
          });
        }
        return updatedMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // オブジェクトがクリックされたときのハンドラー
  const handleObjectClick = (id: string) => {
    console.log(`オブジェクトがクリックされました: ${id}`);
    // 将来的な機能拡張のためのプレースホルダー
  };

  // UIレンダリング部分
  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden p-4 gap-4">
      {/* チャットとナビゲーションエリア */}
      <div className="flex flex-col w-full lg:w-1/2 gap-4 h-full overflow-hidden">
        {/* ナビゲーションヘッダー */}
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <Link
                href="/chats"
                className="text-primary hover:underline mb-2 inline-block"
              >
                ← チャット一覧に戻る
              </Link>
              <h1 className="text-xl font-bold">{chat?.title || "チャット"}</h1>
            </div>
          </div>
        </Card>

        {/* チャット領域 */}
        <Card className="flex-1 p-4 flex flex-col overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden">
            <h2 className="text-xl font-bold mb-4">AI Chat</h2>

            {/* エラーメッセージ表示 */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p>{error}</p>
              </div>
            )}

            {/* メッセージリストコンポーネント */}
            <MessageList messages={formattedMessages} isLoading={isLoading} />

            {/* メッセージ入力コンポーネント */}
            <MessageInput
              convexChatId={chat._id}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
            />
          </div>
        </Card>
      </div>

      {/* プレビュー領域 */}
      <div className="w-full lg:w-1/2 h-full overflow-hidden">
        <Card className="p-4 h-full overflow-auto relative">
          <h2 className="text-xl font-bold mb-4">プレビュー</h2>

          {/* シーンデータビューア */}
          <SceneDataViewer sceneObjects={sceneObjects} />

          {/* シーンプレビューコンポーネント */}
          <ScenePreview
            sceneObjects={sceneObjects}
            isLoading={isLoading}
            onObjectClick={handleObjectClick}
          />
        </Card>
      </div>
    </div>
  );
}
