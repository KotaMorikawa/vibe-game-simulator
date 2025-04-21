import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// 特定のチャットのメッセージを取得する関数
export const listMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc") // 古いメッセージから新しいメッセージの順に取得
      .collect();

    return messages;
  },
});

// ユーザーメッセージを送信・保存する関数
export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
    format: v.optional(v.string()), // テキスト形式の指定（plain, markdown, html等）
  },
  handler: async (ctx, args) => {
    // チャットの存在確認
    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // 改行文字を保持するための処理
    const processedContent = args.content.replace(/\n/g, "\\n");

    // ユーザーメッセージを保存
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      content: processedContent,
      role: "user",
      createdAt: Date.now(),
      format: args.format || "plain", // デフォルトはプレーンテキスト
    });

    return messageId;
  },
});

// AIからのメッセージを保存する関数
export const storeAIMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
    sceneData: v.optional(v.string()),
    format: v.optional(v.string()), // テキスト形式の指定
  },
  handler: async (ctx, args) => {
    // チャットの存在確認
    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // AIメッセージを保存（フォーマットはそのまま保持）
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      content: args.content,
      role: "assistant",
      createdAt: Date.now(),
      sceneData: args.sceneData,
      format: args.format || "plain", // デフォルトはプレーンテキスト
    });

    // チャットにも最新のシーンデータを保存
    if (args.sceneData) {
      await ctx.db.patch(args.chatId, {
        sceneData: args.sceneData,
      });
    }

    return messageId;
  },
});

// 最新のメッセージを取得する関数
export const getLatestMessage = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .first();

    return message;
  },
});

// メッセージを検索する関数
export const searchMessages = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 実際のDBによってはフルテキスト検索の実装方法が異なる
    // ここではシンプルに全メッセージから検索する例を示す
    const allMessages = await ctx.db.query("messages").collect();

    const results = allMessages.filter((message) =>
      message.content.toLowerCase().includes(args.query.toLowerCase())
    );

    // 検索結果を制限
    return results.slice(0, args.limit || 10);
  },
});

// チャット内でのメッセージ検索
export const searchMessagesInChat = query({
  args: {
    chatId: v.id("chats"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();

    return messages.filter((message) =>
      message.content.toLowerCase().includes(args.query.toLowerCase())
    );
  },
});
