// チャットページで使用するユーティリティ関数

import { Message } from "../_components/MessageList";
import { SceneObject } from "@/components/PreviewArea";
import { convertSceneData } from "@/lib/scene";

/**
 * シーンデータを解析してSceneObjectの配列に変換する
 * @param sceneDataJson シーンデータのJSON文字列
 * @returns 変換されたSceneObjectの配列、または失敗時は空配列
 */
export function parseSceneData(sceneDataJson: string | null): SceneObject[] {
  if (!sceneDataJson) return [];

  try {
    const sceneData = JSON.parse(sceneDataJson);
    return convertSceneData(sceneData);
  } catch (e) {
    console.error("シーンデータの解析エラー:", e);
    return [];
  }
}

/**
 * 最新のアシスタントメッセージからシーンデータを抽出する
 * @param messages メッセージ配列
 * @returns 変換されたSceneObjectの配列
 */
export function getLatestSceneObjects(messages: Message[]): SceneObject[] {
  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  if (lastAssistantMsg && lastAssistantMsg.sceneData) {
    return parseSceneData(lastAssistantMsg.sceneData);
  }

  return [];
}

/**
 * エラーメッセージを生成する
 * @param error エラーオブジェクトまたはエラーメッセージ
 * @returns フォーマットされたエラーメッセージ
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "不明なエラーが発生しました";
}
