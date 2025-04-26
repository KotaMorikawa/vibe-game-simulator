// シーン管理のロジックを担当するカスタムフック
import { useState, useEffect } from "react";
import { SceneObject } from "@/components/PreviewArea";
import { Message } from "../_components/MessageList";
import { Chat } from "../_lib/types";
import { convertSceneData } from "@/lib/scene";

export default function useSceneManager(
  initialChat: Chat,
  messages: Message[]
) {
  // デフォルトのシーンオブジェクト
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([
    {
      id: "default-box",
      type: "box",
      color: "#2196f3",
      position: { x: 0, y: 0, z: 0 },
    },
  ]);

  // チャットからシーンデータを直接取得
  useEffect(() => {
    if (initialChat && initialChat.sceneData) {
      try {
        const sceneData = JSON.parse(initialChat.sceneData);
        const convertedObjects = convertSceneData(sceneData);
        if (convertedObjects.length > 0) {
          setSceneObjects(convertedObjects);
        }
      } catch (e) {
        console.error("チャットのシーンデータ解析エラー:", e);
      }
    }
  }, [initialChat]);

  // メッセージからシーンデータを取得
  useEffect(() => {
    if (messages && messages.length > 0) {
      // 最後のアシスタントメッセージからシーンデータを復元
      const lastAssistantMsg = [...messages]
        .reverse()
        .find((m) => m.role === "assistant");

      if (lastAssistantMsg && lastAssistantMsg.sceneData) {
        try {
          const sceneData = JSON.parse(lastAssistantMsg.sceneData);
          const convertedObjects = convertSceneData(sceneData);
          if (convertedObjects.length > 0) {
            setSceneObjects(convertedObjects);
          }
        } catch (e) {
          console.error("保存されたシーンデータの解析エラー:", e);
        }
      }
    }
  }, [messages]);

  // シーンオブジェクトを更新する関数
  const updateSceneObjects = (newObjects: SceneObject[]) => {
    setSceneObjects(newObjects);
  };

  // オブジェクトがクリックされたときのハンドラー
  const handleObjectClick = (id: string) => {
    console.log(`オブジェクトがクリックされました: ${id}`);
    // 将来的な機能拡張のためのプレースホルダー
  };

  return {
    sceneObjects,
    updateSceneObjects,
    handleObjectClick,
  };
}
