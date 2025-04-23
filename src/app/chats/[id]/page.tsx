import { Suspense } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { ChatPageContainer } from "./_containers/ChatPage";

interface chatPageProps {
  params: Promise<{
    id: Id<"chats">;
  }>;
}

export default async function ChatPage({ params }: chatPageProps) {
  // パラメータを取得
  const { id } = await params;

  return (
    <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
      <ChatPageContainer chatId={id} />
    </Suspense>
  );
}
