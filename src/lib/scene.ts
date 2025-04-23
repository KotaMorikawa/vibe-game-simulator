/**
 * シーンデータ変換ユーティリティ関数
 * AIから返されるシーンデータを適切な形式に変換するための関数群
 */

import { SceneObject } from "@/components/PreviewArea";

/**
 * AIが生成したシーンデータをアプリケーションで使用可能な形式に変換する
 * 入力形式: { scene: { objects: [...] } } または 直接SceneObject配列
 * 出力形式: SceneObject配列
 */
interface RawSceneObject {
  id: string | number;
  type: string;
  color: string;
  position: number[] | { x: number; y: number; z: number };
  rotation: number[] | { x: number; y: number; z: number };
  scale: number[] | { x: number; y: number; z: number };
}

export function convertSceneData(sceneData: {
  scene: { objects: RawSceneObject[] };
  length: number;
  map: (arg0: (obj: RawSceneObject) => SceneObject) => SceneObject[];
}): SceneObject[] {
  try {
    // AIが生成したシーンデータは { scene: { objects: [...] } } 形式
    if (sceneData.scene && Array.isArray(sceneData.scene.objects)) {
      return sceneData.scene.objects.map(convertSceneObject);
    }
    // すでに配列形式の場合
    else if (Array.isArray(sceneData) && sceneData.length > 0) {
      return sceneData.map(convertSceneObject);
    }
    // どのパターンにも当てはまらない場合は空配列を返す
    return [];
  } catch (e) {
    console.error("Error converting scene data:", e);
    return [];
  }
}

/**
 * 個々のシーンオブジェクトを変換する
 * [x,y,z] 形式の配列を {x,y,z} オブジェクト形式に変換
 */
export function convertSceneObject(obj: RawSceneObject): SceneObject {
  // Validate that type is one of the allowed values or default to "box"
  const validType: "box" | "sphere" | "square" | "circle" =
    obj.type === "box" ||
    obj.type === "sphere" ||
    obj.type === "square" ||
    obj.type === "circle"
      ? (obj.type as "box" | "sphere" | "square" | "circle")
      : "box";

  return {
    id: String(obj.id),
    type: validType,
    color: obj.color,
    position: Array.isArray(obj.position)
      ? { x: obj.position[0], y: obj.position[1], z: obj.position[2] }
      : obj.position,
    rotation: Array.isArray(obj.rotation)
      ? { x: obj.rotation[0], y: obj.rotation[1], z: obj.rotation[2] }
      : obj.rotation,
    scale: Array.isArray(obj.scale)
      ? { x: obj.scale[0], y: obj.scale[1], z: obj.scale[2] }
      : obj.scale,
  };
}
