import { Suspense } from "react";
import { api } from "../../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import ChatsList from "@/components/ChatsList";
import NewChatButton from "@/components/NewChatButton";
import { getConvexClient } from "@/lib/convex";

// データをサーバー側で取得する関数
async function getChats() {
  try {
    // Convexクライアントの初期化
    const convex = getConvexClient();
    // チャットを取得
    const chats = await convex.query(api.chats.listChats, {});
    return chats || [];
  } catch (error) {
    console.error("チャットの取得に失敗しました:", error);
    return [];
  }
}

export default async function ChatsPage() {
  // サーバーコンポーネントでデータを取得
  const chats = await getChats();

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">チャット一覧</h1>
        <NewChatButton />
      </div>

      <Suspense fallback={<div>チャットを読み込み中...</div>}>
        {chats.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="mb-4 text-muted-foreground">
              チャットはまだありません
            </p>
            <NewChatButton />
          </Card>
        ) : (
          <ChatsList chats={chats} />
        )}
      </Suspense>

      <div className="mt-8 text-center">
        <Link href="/" className="text-primary hover:underline">
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
