// API通信を担当するカスタムフック
import { Message } from "../_components/MessageList";
import { Id } from "../../../../../convex/_generated/dataModel";
import { SceneObject } from "@/components/PreviewArea";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex";

interface SendMessageParams {
  messages: Message[];
  newMessage: Message;
  chatId: Id<"chats">;
  updateMessageContent: (content: string) => void;
}

export default function useChatApi() {
  const sendMessageToApi = async ({
    messages,
    newMessage,
    chatId,
    updateMessageContent,
  }: SendMessageParams) => {
    // APIリクエスト
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        newMessage,
        chatId,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    // SSEレスポンスのストリームを処理
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is null");
    }

    // ストリームからテキストをデコード
    const decoder = new TextDecoder();
    let aiResponseText = "";
    let bufferText = "";
    let completionData: { chatId: string; messageId: string } | null = null;
    let sceneObjectsData: SceneObject[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // テキストをデコードしバッファに追加
      const chunk = decoder.decode(value, { stream: true });
      bufferText += chunk;

      // イベントごとに分割（空行で区切られている）
      const events = bufferText.split("\n\n");

      // 最後のイベントが不完全な場合はバッファに残す
      bufferText = events.pop() || "";

      for (const event of events) {
        // JSON更新イベントの処理 - シーンオブジェクト専用
        if (event.includes("event: json_update")) {
          try {
            // データ部分を抽出 (event: json_update\ndata: {...})
            const dataMatch = event.match(/data: (.+)$/);
            if (dataMatch && dataMatch[1]) {
              const jsonData = dataMatch[1];
              // JSONをパース
              const objectData = JSON.parse(jsonData);
              // シーンオブジェクトが有効かどうかを確認
              if (Array.isArray(objectData) && objectData.length > 0) {
                // シーンオブジェクトを更新
                sceneObjectsData = [...objectData];
              }
            }
          } catch (e) {
            console.error("JSON処理エラー:", e);
          }
        }
        // 完了イベントの処理
        else if (event.includes("event: completion")) {
          try {
            // データ部分を抽出 (event: completion\ndata: {...})
            const dataMatch = event.match(/data: (.+)$/);
            if (dataMatch && dataMatch[1]) {
              completionData = JSON.parse(dataMatch[1]);
              console.log("完了イベント:", completionData);

              // 応答が完了したら、実際のメッセージをDBに保存
              try {
                const convex = getConvexClient();
                await convex.mutation(api.messages.storeAIMessage, {
                  chatId,
                  content: aiResponseText,
                  sceneData: JSON.stringify(sceneObjectsData),
                });
              } catch (storeError) {
                console.error("メッセージの保存エラー:", storeError);
              }
            }
          } catch (e) {
            console.error("完了イベント処理エラー:", e);
          }
        }
        // テキストチャンクの処理
        else if (event.startsWith("data: ")) {
          const text = event.replace("data: ", "");
          aiResponseText += text;

          // テキストのみをメッセージに表示
          updateMessageContent(aiResponseText);
        }
      }
    }

    return {
      responseText: aiResponseText,
      sceneObjects: sceneObjectsData,
      messageId: completionData?.messageId || null,
    };
  };

  return {
    sendMessageToApi,
  };
}
