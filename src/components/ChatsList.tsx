"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GenericId } from "convex/values";

// 型定義
interface Chat {
  _id: GenericId<"chats">;
  title: string;
  createdAt: number;
}

interface ChatsListProps {
  chats: Chat[];
}

export default function ChatsList({ chats }: ChatsListProps) {
  const deleteChat = useMutation(api.chats.deleteChat);

  // チャットを削除
  const handleDeleteChat = async (
    id: GenericId<"chats">,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirm("このチャットを削除してもよろしいですか？")) {
      await deleteChat({ id });
    }
  };

  // 日付をフォーマット
  const formatDate = (timestamp: string | number | Date) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="grid gap-4">
      {chats.map((chat) => (
        <Link href={`/chats/${chat._id}`} key={chat._id} className="block">
          <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-xl truncate">
                  {chat.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatDate(chat.createdAt)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleDeleteChat(chat._id, e)}
                className="ml-2"
              >
                削除
              </Button>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}