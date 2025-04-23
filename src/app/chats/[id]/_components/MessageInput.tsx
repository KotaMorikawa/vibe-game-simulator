"use client";

import React, { useState } from "react";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Message } from "./MessageList";

interface MessageInputProps {
  convexChatId: Id<"chats">;
  isLoading: boolean;
  onSendMessage: (message: Message) => void;
}

export default function MessageInput({
  isLoading,
  onSendMessage,
}: MessageInputProps) {
  const [input, setInput] = useState<string>("");
  const [isComposing, setIsComposing] = useState<boolean>(false); // IME入力中かどうかを追跡

  // メッセージ送信ハンドラー
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // 新しいユーザーメッセージを作成
    const userMessage: Message = { role: "user", content: input };

    // 親コンポーネントに通知
    onSendMessage(userMessage);

    // 入力フィールドをクリア
    setInput("");
  };

  // Enterキーでメッセージを送信 - IME入力中は無視
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex mt-auto">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder="メッセージを入力..."
        disabled={isLoading}
        className="flex-1 p-2 border rounded min-h-[40px] max-h-[200px] resize-none"
        rows={1}
        style={{
          height: "auto",
          overflow: "hidden",
        }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = "auto";
          target.style.height = `${target.scrollHeight}px`;
        }}
      />
    </div>
  );
}
