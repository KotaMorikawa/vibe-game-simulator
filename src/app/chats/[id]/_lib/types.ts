// チャットページで使用する型定義

import { Id } from "../../../../../convex/_generated/dataModel";

// チャットの型定義
export type Chat = {
  _id: Id<"chats">;
  title: string;
  createdAt?: number;
  sceneData?: string;
};

// メッセージングAPI用のレスポンス型
export interface ChatResponse {
  response: string;
  messageId?: string;
  sceneData?: string;
  error?: string;
}

// SSEイベント型
export interface CompletionEvent {
  chatId: string;
  messageId: string;
}

// シーン処理用のユーティリティ型
export interface SceneProcessingResult {
  text: string;
  sceneData: string | null;
}
