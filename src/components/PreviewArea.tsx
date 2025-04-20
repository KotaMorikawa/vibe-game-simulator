"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Box,
  Sphere,
  Plane,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import { Vector3 } from "three";
import * as THREE from "three";

// シーン内のオブジェクトの型定義
export type SceneObject = {
  id: string;
  type: "box" | "sphere" | "square" | "circle";
  color: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
};

type PreviewAreaProps = {
  objects: SceneObject[];
  onObjectClick?: (id: string) => void;
};

// 個別のオブジェクトを描画するコンポーネント
const SceneObjectRenderer = ({
  object,
  onClick,
}: {
  object: SceneObject;
  onClick?: (id: string) => void;
}) => {
  const ref = useRef<THREE.Mesh>(null);

  // 簡易的なアニメーション効果（回転）
  useFrame(() => {
    if (ref.current && object.rotation) {
      // 自動回転を追加する場合はここで設定
      // ref.current.rotation.x += 0.01;
      // ref.current.rotation.y += 0.01;
    }
  });

  const position = new Vector3(
    object.position.x,
    object.position.y,
    object.position.z
  );
  const color = object.color;
  const rotation = object.rotation
    ? [object.rotation.x, object.rotation.y, object.rotation.z]
    : [0, 0, 0];
  const scale = object.scale
    ? [object.scale.x, object.scale.y, object.scale.z]
    : [1, 1, 1];

  const handleClick = () => {
    if (onClick) {
      onClick(object.id);
    }
    console.log(`Clicked object: ${object.id}`);
  };

  // オブジェクトタイプに基づいてコンポーネントを選択
  switch (object.type) {
    case "box":
      return (
        <Box
          ref={ref}
          args={[1, 1, 1]}
          position={position}
          rotation={rotation as [number, number, number]}
          scale={scale as [number, number, number]}
          onClick={handleClick}
        >
          <meshStandardMaterial color={color} />
        </Box>
      );
    case "sphere":
      return (
        <Sphere
          ref={ref}
          args={[0.5, 32, 32]}
          position={position}
          rotation={rotation as [number, number, number]}
          scale={scale as [number, number, number]}
          onClick={handleClick}
        >
          <meshStandardMaterial color={color} />
        </Sphere>
      );
    case "square":
      return (
        <Plane
          ref={ref}
          args={[1, 1]}
          position={position}
          rotation={rotation as [number, number, number]}
          scale={scale as [number, number, number]}
          onClick={handleClick}
        >
          <meshStandardMaterial color={color} />
        </Plane>
      );
    case "circle":
      return (
        <Sphere
          ref={ref}
          args={[0.5, 32, 32]}
          position={position}
          rotation={[Math.PI / 2, 0, 0]} // 円として表示するために回転
          scale={[1, 1, 0.01]} // 非常に薄くして2D的に見せる
          onClick={handleClick}
        >
          <meshStandardMaterial color={color} />
        </Sphere>
      );
    default:
      return null;
  }
};

const PreviewArea = ({ objects, onObjectClick }: PreviewAreaProps) => {
  return (
    <div className="w-full h-full min-h-[300px]">
      <Canvas shadows>
        {/* カメラ設定 */}
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <OrbitControls />

        {/* 光源 */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        {/* 背景色 */}
        <color attach="background" args={["#f0f0f0"]} />

        {/* オブジェクトのレンダリング */}
        {objects.map((object) => (
          <SceneObjectRenderer
            key={object.id}
            object={object}
            onClick={onObjectClick}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default PreviewArea;
