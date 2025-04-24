import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { submitQuestion, extractSceneData } from "@/lib/langgraph";
import {
  StreamMessageType,
  SSE_DATA_PREFIX,
  SSE_LINE_DELIMITER,
  StreamMessage,
  ChatRequestBody,
  Message,
} from "@/lib/types";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getConvexClient } from "@/lib/convex";

// 環境変数からAPIキーを取得
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// POSTハンドラー
export async function POST(req: Request) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  if (!convexUrl) {
    return NextResponse.json(
      { error: "Convex URL not configured" },
      { status: 500 }
    );
  }

  try {
    // リクエストからデータを取得
    const { messages, newMessage, chatId } =
      (await req.json()) as ChatRequestBody;

    // Convexクライアントの初期化
    const convex = getConvexClient();

    // Create stream with large queue strategy for better performance
    const stream = new TransformStream({}, { highWaterMark: 1024 });
    const writer = stream.writable.getWriter();

    const response = new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

    const startStream = async () => {
      try {
        // Send initial connection established message
        await sendSSEMessage(writer, { type: StreamMessageType.Connected });

        // Send user message to Convex
        await convex.mutation(api.messages.sendMessage, {
          chatId,
          content: newMessage.content,
        });

        // 最新のシーンデータを取得（チャットから）
        let lastSceneData = null;
        try {
          const chat = await convex.query(api.chats.getChat, { id: chatId });
          if (chat && chat.sceneData) {
            lastSceneData = chat.sceneData;
          }
        } catch (error) {
          console.error("Error fetching scene data:", error);
        }

        // Convert messages to LangChain format
        const langChainMessages = [
          ...messages.map((msg: Message) =>
            msg.role === "user"
              ? new HumanMessage(msg.content)
              : new AIMessage(msg.content)
          ),
          new HumanMessage(newMessage.content),
        ];

        try {
          // AIの完全な応答を収集するための変数
          let completeAIResponse = "";

          // 最新のシーンデータを渡す
          const eventStream = await submitQuestion(
            langChainMessages,
            chatId,
            lastSceneData
          );

          // Process the events
          for await (const event of eventStream) {
            if (event.event === "on_chat_model_stream") {
              const token = event.data.chunk;
              if (token) {
                // AIMessageChunkからテキストを取得（形式に応じて処理を分ける）
                let text;

                // 配列形式のcontentの場合
                if (Array.isArray(token.content) && token.content.length > 0) {
                  const content = token.content[0];
                  text =
                    typeof content === "object" && "text" in content
                      ? content.text
                      : content;
                }
                // 文字列形式のcontentの場合
                else if (typeof token.content === "string") {
                  text = token.content;
                }

                if (text) {
                  // 完全な応答に追加
                  completeAIResponse += text;

                  await sendSSEMessage(writer, {
                    type: StreamMessageType.Token,
                    token: text,
                  });
                }
              }
            } else {
              await sendSSEMessage(writer, {
                type: StreamMessageType.Done,
              });
            }
          }

          // ストリーミングが完了したら、収集した完全な応答からシーンデータを抽出して保存
          try {
            // 収集した完全な応答からシーンデータを抽出
            const sceneData = extractSceneData(completeAIResponse);

            if (sceneData) {
              try {
                // シーンデータをDBに保存 - 新しいAIメッセージとして保存
                await convex.mutation(api.messages.storeAIMessage, {
                  chatId,
                  content: completeAIResponse,
                  sceneData,
                  format: "plain",
                });

                // チャットデータも更新
                await convex.mutation(api.chats.updateChatSceneData, {
                  id: chatId,
                  sceneData,
                });
              } catch (saveError) {
                console.error("Error during DB save operations:", saveError);
              }
            }
          } catch (dbError) {
            console.error("Error saving scene data to DB:", dbError);
          }
        } catch (streamError) {
          console.error("Error in event stream:", streamError);
          await sendSSEMessage(writer, {
            type: StreamMessageType.Error,
            error:
              streamError instanceof Error
                ? streamError.message
                : "Stream processing failed",
          });
        }
      } catch (error) {
        console.error("Error in stream:", error);
        await sendSSEMessage(writer, {
          type: StreamMessageType.Error,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        try {
          await writer.close();
        } catch (closeError) {
          console.error("Error closing writer:", closeError);
        }
      }
    };

    startStream();

    return response;
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" } as const,
      {
        status: 500,
      }
    );
  }
}

// SSEメッセージを送信するユーティリティ関数
const sendSSEMessage = async (
  writer: WritableStreamDefaultWriter<Uint8Array>,
  data: StreamMessage
) => {
  const encoder = new TextEncoder();
  return writer.write(
    encoder.encode(
      `${SSE_DATA_PREFIX}${JSON.stringify(data)}${SSE_LINE_DELIMITER}`
    )
  );
};
