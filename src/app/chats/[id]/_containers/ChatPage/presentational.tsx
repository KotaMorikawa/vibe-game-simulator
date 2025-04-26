"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import MessageList from "../../_components/MessageList";
import MessageInput from "../../_components/MessageInput";
import ScenePreview, { SceneDataViewer } from "../../_components/ScenePreview";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Chat } from "../../_lib/types";
import { Message } from "../../_components/MessageList";
import { ChatProvider, useChatContext } from "../../_context/ChatContext";

interface ChatPageClientProps {
  chatId: Id<"chats">;
  initialChat: Chat;
  initialMessages: Message[];
}

// 内部コンポーネント - コンテキストを使用
function ChatPageContent() {
  const {
    formattedMessages,
    sceneObjects,
    isLoading,
    error,
    sendMessage,
    handleObjectClick,
    initialChat,
  } = useChatContext();

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
              <h1 className="text-xl font-bold">
                {initialChat?.title || "チャット"}
              </h1>
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
              convexChatId={initialChat._id}
              isLoading={isLoading}
              onSendMessage={sendMessage}
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

// メインコンポーネント - コンテキストプロバイダーをラップ
export default function ChatPagePresentational({
  chatId,
  initialChat,
  initialMessages,
}: ChatPageClientProps) {
  return (
    <ChatProvider
      chatId={chatId}
      initialChat={initialChat}
      initialMessages={initialMessages}
    >
      <ChatPageContent />
    </ChatProvider>
  );
}
