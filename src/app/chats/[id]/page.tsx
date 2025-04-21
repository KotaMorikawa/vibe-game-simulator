import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import ChatPageClient from "./ChatPageClient";

// Convexクライアントの初期化
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
const convex = new ConvexHttpClient(convexUrl);

// データをサーバー側で取得する関数
async function getChatAndMessages(id: string) {
  try {
    const chat = await convex.query(api.chats.getChat, { id });
    if (!chat) {
      return { chat: null, messages: [] };
    }

    const messages = await convex.query(api.messages.listMessages, {
      chatId: id,
    });
    return { chat, messages: messages || [] };
  } catch (error) {
    console.error("チャットとメッセージの取得に失敗しました:", error);
    return { chat: null, messages: [] };
  }
}

export default async function ChatPage({ params }: { params: { id: string } }) {
  // パラメータを取得
  const { id } = params;

  // パラメータが無効な場合は404
  if (!id) {
    notFound();
  }

  // サーバーコンポーネントでデータを取得
  const { chat, messages } = await getChatAndMessages(id);

  // チャットが存在しない場合は404
  if (!chat) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
      <ChatPageClient
        chatId={id}
        initialChat={chat}
        initialMessages={messages}
      />
    </Suspense>
  );
}
