import { Id } from "../../convex/_generated/dataModel";

// SSEのフォーマット定数
export const SSE_DATA_PREFIX = "data: " as const;
export const SEE_DONE_MESSAGE = "[DONE]" as const;
export const SSE_LINE_DELIMITER = "\n\n" as const;

export type MessageRole = "user" | "assistant";

// メッセージの型
export interface Message {
  role: MessageRole;
  content: string;
}

// チャットリクエストボディの型
export interface ChatRequestBody {
  messages: Message[];
  newMessage: Message;
  chatId: Id<"chats">;
}

// ストリームメッセージタイプの列挙型
export enum StreamMessageType {
  Token = "token",
  Error = "error",
  Connected = "connected",
  Done = "done",
  ToolStart = "tool_start",
  ToolEnd = "tool_end",
  SceneData = "scene_data", // シーンデータ用のタイプを追加
}

// ストリームメッセージの基本インターフェース
export interface BaseStreamMessage {
  type: StreamMessageType;
}

// 接続確立メッセージ
export interface ConnectedStreamMessage extends BaseStreamMessage {
  type: StreamMessageType.Connected;
}

// トークンメッセージ
export interface TokenStreamMessage extends BaseStreamMessage {
  type: StreamMessageType.Token;
  token: string;
}

// ツール開始メッセージ
export interface ToolStartStreamMessage extends BaseStreamMessage {
  type: StreamMessageType.ToolStart;
  tool: string;
  input: string;
}

// ツール終了メッセージ
export interface ToolEndStreamMessage extends BaseStreamMessage {
  type: StreamMessageType.ToolEnd;
  tool: string;
  output: string;
}

// 完了メッセージ
export interface DoneStreamMessage extends BaseStreamMessage {
  type: StreamMessageType.Done;
}

// エラーメッセージ
export interface ErrorStreamMessage extends BaseStreamMessage {
  type: StreamMessageType.Error;
  error: string;
}

// シーンデータメッセージ
export interface SceneDataStreamMessage extends BaseStreamMessage {
  type: StreamMessageType.SceneData;
  data: SceneObject[];
}

// すべてのストリームメッセージ型のユニオン型
export type StreamMessage =
  | ConnectedStreamMessage
  | TokenStreamMessage
  | ToolStartStreamMessage
  | ToolEndStreamMessage
  | DoneStreamMessage
  | ErrorStreamMessage
  | SceneDataStreamMessage;

// シーンオブジェクトの型定義
export type SceneObject = {
  id: string;
  type: "box" | "sphere" | "square" | "circle";
  color: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
};
