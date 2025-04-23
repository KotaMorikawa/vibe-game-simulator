// MessageList.tsx - メッセージ一覧プレゼンテーショナルコンポーネント

import React, { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Id } from "../../../../../convex/_generated/dataModel";

// メッセージの型定義
export type Message = {
  role: "user" | "assistant";
  content: string;
  _id?: Id<"messages">;
  chatId?: Id<"chats">;
  createdAt?: number;
  sceneData?: string;
};

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  // スクロールエリアの参照
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // メッセージが追加されたときに自動スクロール
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <ScrollArea
      className="flex-1 overflow-auto"
      style={{ height: "calc(100% - 80px)" }}
      ref={scrollAreaRef}
    >
      <div className="flex flex-col gap-4 p-2 pb-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`${
              message.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-muted"
            } p-3 rounded-lg max-w-[80%]`}
          >
            {message.role === "assistant" ? (
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="mr-auto bg-muted p-3 rounded-lg">
            <p>考え中...</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
