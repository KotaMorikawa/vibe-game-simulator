import { Id } from "../../../../../../convex/_generated/dataModel";
import ChatPagePresentational from "./presentational";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

// Convexクライアントの初期化
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
const convex = new ConvexHttpClient(convexUrl);

// データをサーバー側で取得する関数
async function getChatAndMessages(id: Id<"chats">) {
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
