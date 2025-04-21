import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // チャットセッションを保存するテーブル
  chats: defineTable({
    title: v.string(),
    userId: v.optional(v.string()), // 認証実装時に使用
    createdAt: v.number(),
    sceneData: v.optional(v.string()), // 最後のシーンデータをJSON文字列として保存
  }).index("by_user", ["userId"]),

  // 個々のメッセージを保存するテーブル
  messages: defineTable({
    chatId: v.id("chats"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    createdAt: v.number(),
    sceneData: v.optional(v.string()), // シーンデータをJSON文字列として保存（assistantの場合）
    format: v.optional(v.string()), // テキスト形式：plain, markdown, html等
  }).index("by_chat", ["chatId"]),
});
