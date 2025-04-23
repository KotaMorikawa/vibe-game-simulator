// ScenePreview.tsx - シーンプレビュー用プレゼンテーショナルコンポーネント

import React from "react";
import PreviewArea, { SceneObject } from "@/components/PreviewArea";

interface ScenePreviewProps {
  sceneObjects: SceneObject[];
  isLoading: boolean;
  onObjectClick?: (id: string) => void;
}

export default function ScenePreview({
  sceneObjects,
  isLoading,
  onObjectClick,
}: ScenePreviewProps) {
  return (
    <div className="h-[50vh] md:h-[60vh] relative">
      {/* ローディングオーバーレイ */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10 backdrop-blur-sm">
          <div className="bg-white/90 p-4 rounded-lg shadow-lg text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="font-medium">シーンを更新中...</p>
          </div>
        </div>
      )}
      <PreviewArea
        objects={sceneObjects}
        onObjectClick={(id) => {
          if (onObjectClick) {
            onObjectClick(id);
          } else {
            console.log(`オブジェクトがクリックされました: ${id}`);
          }
        }}
      />
    </div>
  );
}

// シーンデータを表示するコンポーネント
export function SceneDataViewer({
  sceneObjects,
}: {
  sceneObjects: SceneObject[];
}) {
  return (
    <div className="mb-4">
      <details>
        <summary className="font-semibold cursor-pointer">
          現在のモデルデータ
        </summary>
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs whitespace-pre-wrap overflow-auto max-h-[200px]">
          <pre>{JSON.stringify(sceneObjects, null, 2)}</pre>
        </div>
        <button
          className="mt-2 text-xs px-2 py-1 bg-blue-500 text-white rounded"
          onClick={() => {
            navigator.clipboard
              .writeText(JSON.stringify(sceneObjects, null, 2))
              .then(() => alert("JSONデータをクリップボードにコピーしました"))
              .catch((err) => console.error("コピーに失敗しました:", err));
          }}
        >
          JSONデータをコピー
        </button>
      </details>
    </div>
  );
}
