// チャットの状態を管理するコンテキスト
import React, { createContext, useContext } from "react";
import { Message } from "../_components/MessageList";
import { SceneObject } from "@/components/PreviewArea";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Chat } from "../_lib/types";
import useChatMessages from "../_hooks/useChatMessages";
import useSceneManager from "../_hooks/useSceneManager";

// コンテキストの型定義
interface ChatContextType {
  messages: Message[];
  formattedMessages: Message[];
  sceneObjects: SceneObject[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: Message) => Promise<void>;
  handleObjectClick: (id: string) => void;
  chatId: Id<"chats">;
  initialChat: Chat;
  updateSceneObjects: (newObjects: SceneObject[]) => void;
  setError: (error: string | null) => void;
}

// デフォルト値
const defaultContext: ChatContextType = {
  messages: [],
  formattedMessages: [],
  sceneObjects: [],
  isLoading: false,
  error: null,
  sendMessage: async () => {},
  handleObjectClick: () => {},
  chatId: "" as Id<"chats">,
  initialChat: {} as Chat,
  updateSceneObjects: () => {},
  setError: () => {},
};

// コンテキスト作成
const ChatContext = createContext<ChatContextType>(defaultContext);

// コンテキストプロバイダー
export function ChatProvider({
  children,
  chatId,
  initialChat,
  initialMessages,
}: {
  children: React.ReactNode;
  chatId: Id<"chats">;
  initialChat: Chat;
  initialMessages: Message[];
}) {
  const {
    messages,
    formattedMessages,
    isLoading,
    error,
    setError,
    sendMessage,
  } = useChatMessages(chatId, initialMessages);

  const { sceneObjects, updateSceneObjects, handleObjectClick } =
    useSceneManager(initialChat, formattedMessages);

  // コンテキスト値
  const contextValue: ChatContextType = {
    messages,
    formattedMessages,
    sceneObjects,
    isLoading,
    error,
    sendMessage,
    handleObjectClick,
    chatId,
    initialChat,
    updateSceneObjects,
    setError,
  };

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
}

// コンテキスト使用カスタムフック
export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
