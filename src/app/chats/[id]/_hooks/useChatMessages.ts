// メッセージ関連のロジックを担当するカスタムフック
import { useState, useEffect } from "react";
import { Message } from "../_components/MessageList";
import { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex";
import useChatApi from "./useChatApi";

export default function useChatMessages(
  chatId: Id<"chats">,
  initialMessages: Message[]
) {
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [formattedMessages, setFormattedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { sendMessageToApi } = useChatApi();

  // メッセージフォーマット処理
  useEffect(() => {
    if (messages && messages.length > 0) {
      const formatted: Message[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        _id: msg._id,
        chatId: msg.chatId,
        createdAt: msg.createdAt,
        sceneData: msg.sceneData,
      }));

      setFormattedMessages(formatted);
    } else if (messages && messages.length === 0) {
      // 空のメッセージ配列を受け取った場合のみ、一度だけデフォルトメッセージを設定
      if (formattedMessages.length === 0) {
        setFormattedMessages([
          {
            role: "user",
            content: "3Dシーンについて案内してください",
          },
          {
            role: "assistant",
            content:
              "こんにちは！3Dシーンについて何か指示してください。例えば「赤い球と青い立方体を配置して」など。",
          },
        ]);
      }
    }
  }, [messages, formattedMessages.length]);

  // メッセージ送信ハンドラー
  const sendMessage = async (userMessage: Message) => {
    if (isLoading) return;

    // エラー状態をリセット
    setError(null);

    // 新しいユーザーメッセージを追加（楽観的更新）
    const newUserMessage = {
      ...userMessage,
      _id: `temp_${Date.now()}`,
      chatId,
      createdAt: Date.now(),
    };

    setFormattedMessages((prev) => [...prev, newUserMessage as Message]);
    setIsLoading(true);

    try {
      // AIの応答用の仮のメッセージを追加
      setFormattedMessages((prev) => [
        ...prev,
        { role: "assistant", content: "考え中..." },
      ]);

      // APIを呼び出して応答を処理
      const { responseText, sceneObjects, messageId } = await sendMessageToApi({
        messages: formattedMessages,
        newMessage: userMessage,
        chatId,
        updateMessageContent: (content) => {
          setFormattedMessages((prev) => {
            const updatedMessages = [...prev];
            updatedMessages[updatedMessages.length - 1].content = content;
            return updatedMessages;
          });
        },
      });

      // 完了したメッセージの作成
      const fullMessageData = {
        _id: messageId || `temp_${Date.now()}`,
        chatId,
        content: responseText,
        role: "assistant",
        createdAt: Date.now(),
        sceneData: JSON.stringify(sceneObjects),
      };

      // 応答が完了した後、メッセージ配列を更新
      setMessages((prev) => [...prev, fullMessageData as Message]);

      // ユーザーメッセージも保存
      try {
        const convex = getConvexClient();
        await convex.mutation(api.messages.sendMessage, {
          chatId,
          content: userMessage.content,
        });
      } catch (error) {
        console.error("ユーザーメッセージの保存エラー:", error);
      }
    } catch (error) {
      console.error("メッセージ送信エラー:", error);
      setError(
        error instanceof Error ? error.message : "不明なエラーが発生しました"
      );

      // エラーメッセージを表示
      setFormattedMessages((prev) => {
        const updatedMessages = [...prev];
        if (updatedMessages[updatedMessages.length - 1].role === "assistant") {
          updatedMessages[updatedMessages.length - 1].content =
            "エラーが発生しました。もう一度お試しください。";
        } else {
          updatedMessages.push({
            role: "assistant",
            content: "エラーが発生しました。もう一度お試しください。",
          });
        }
        return updatedMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    formattedMessages,
    isLoading,
    error,
    setError,
    sendMessage,
  };
}
