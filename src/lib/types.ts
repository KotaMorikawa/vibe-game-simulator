// ストリームメッセージタイプの列挙型
export enum StreamMessageType {
  Connected = "connected",
  Token = "token",
  ToolStart = "tool_start",
  ToolEnd = "tool_end",
  Done = "done",
  Error = "error",
  SceneData = "scene_data", // シーンデータ用のタイプを追加
}

// チャットリクエストボディの型
export interface ChatRequestBody {
  messages: { role: string; content: string }[];
  newMessage: string;
  chatId: string;
}

// SSEのフォーマット定数
export const SSE_DATA_PREFIX = "data: ";
export const SSE_LINE_DELIMITER = "\n\n";

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
