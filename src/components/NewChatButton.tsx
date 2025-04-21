"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function NewChatButton() {
  const router = useRouter();
  const createChat = useMutation(api.chats.createChat);
  const [isCreating, setIsCreating] = useState(false);

  // 新しいチャットを作成
  const handleNewChat = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      const title = "新しいチャット " + new Date().toLocaleString();
      const newChatId = await createChat({ title });
      router.push(`/chats/${newChatId}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button onClick={handleNewChat} disabled={isCreating} className="w-full">
      {isCreating ? "作成中..." : "チャットを開始"}
    </Button>
  );
}
