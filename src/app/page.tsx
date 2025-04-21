// サーバーコンポーネント - データフェッチングをサーバー側で行う
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Suspense } from "react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import NewChatButton from "@/components/NewChatButton";
import RecentChatsList from "@/components/RecentChatsList";

// Convexクライアントの初期化
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
const convex = new ConvexHttpClient(convexUrl);

// データをサーバー側で取得する関数
async function getChats() {
  try {
    const chats = await convex.query(api.chats.listChats);
    return chats || [];
  } catch (error) {
    console.error("チャットの取得に失敗しました:", error);
    return [];
  }
}

export default async function Home() {
  // サーバーコンポーネントでデータを取得
  const chats = await getChats();

  return (
    <div className="container mx-auto max-w-5xl flex flex-col min-h-screen p-4">
      <header className="py-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Vibe Game Simulator</h1>
        <p className="text-lg text-muted-foreground mb-8">
          AIと対話しながら3Dシーンを作成・編集することができます
        </p>
      </header>

      <main className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <Card className="p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow">
            <h2 className="text-2xl font-bold mb-4">新しいチャットを開始</h2>
            <p className="mb-6 text-muted-foreground">
              AIと対話して、新しい3Dシーンを作成します。
            </p>
            {/* クライアント側のインタラクションが必要な部分のみクライアントコンポーネントとして分離 */}
            <NewChatButton />
          </Card>

          <Card className="p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow">
            <h2 className="text-2xl font-bold mb-4">チャット履歴</h2>
            <p className="mb-6 text-muted-foreground">
              過去のチャットセッションと作成したシーンを表示します。
            </p>
            <Link href="/chats" className="w-full">
              <Button className="w-full" variant="outline">
                チャット一覧を表示
              </Button>
            </Link>
          </Card>
        </div>

        {chats.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4">最近のチャット</h2>
            <Suspense fallback={<div>チャットを読み込み中...</div>}>
              <RecentChatsList chats={chats.slice(0, 3)} />
            </Suspense>
            {chats.length > 3 && (
              <div className="text-center mt-4">
                <Link href="/chats">
                  <Button variant="ghost">すべてのチャットを表示</Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>© 2025 Vibe Game Simulator</p>
      </footer>
    </div>
  );
}
