import { Id } from "../../../../../../convex/_generated/dataModel";
import ChatPagePresentational from "./presentational";
import { notFound } from "next/navigation";
import { api } from "../../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex";

// データをサーバー側で取得する関数
async function getChatAndMessages(id: Id<"chats">) {
  try {
    // Convexクライアントの初期化
    const convex = getConvexClient();

    // チャットとメッセージを取得
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

// チャットページコンテナコンポーネントのprops
interface ChatPageContainerProps {
  chatId: Id<"chats">;
}

export async function ChatPageContainer({ chatId }: ChatPageContainerProps) {
  // サーバーコンポーネントでデータを取得
  const { chat, messages } = await getChatAndMessages(chatId);

  // チャットが存在しない場合は404
  if (!chat) {
    notFound();
  }

  return (
    <ChatPagePresentational
      chatId={chatId}
      initialChat={chat}
      initialMessages={messages}
    />
  );
}
