import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// 新しいチャットを作成する関数
export const createChat = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    // ここで認証情報を使用することも可能
    // const identity = await ctx.auth.getUserIdentity();
    // const userId = identity?.subject || "anonymous";

    const userId = "anonymous"; // 簡易実装として匿名ユーザーを使用

    const chatId = await ctx.db.insert("chats", {
      title: args.title,
      userId,
      createdAt: Date.now(),
    });

    return chatId;
  },
});

// すべてのチャットを取得する関数
export const listChats = query({
  args: {}, // 空の引数オブジェクトを明示的に追加
  handler: async (ctx) => {
    // 認証実装時は特定ユーザーのチャットのみを取得するように変更可能
    // const identity = await ctx.auth.getUserIdentity();
    // const userId = identity?.subject;
    // if (!userId) return [];

    const chats = await ctx.db
      .query("chats")
      // .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return chats;
  },
});

// 特定のチャットを取得する関数
export const getChat = query({
  args: {
    id: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.id);
    return chat;
  },
});

// 特定のチャットを削除する関数
export const deleteChat = mutation({
  args: {
    id: v.id("chats"),
  },
  handler: async (ctx, args) => {
    // 認証確認も追加可能
    // const chat = await ctx.db.get(args.id);
    // if (!chat) throw new Error("Chat not found");

    // まず関連するメッセージを削除
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // チャット自体を削除
    await ctx.db.delete(args.id);

    return { success: true };
  },
});
