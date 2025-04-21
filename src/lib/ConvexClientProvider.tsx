"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

// Convexクライアントの初期化
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = new ConvexReactClient(convexUrl!);

export default function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
