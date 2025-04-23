import {
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  trimMessages,
} from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import SYSTEM_MESSAGE from "../../constants/systemMessage";

// 会話履歴を管理するためのトリマー
const trimmer = trimMessages({
  maxTokens: 4000,
  strategy: "last",
  tokenCounter: (msgs) => {
    // 簡易的なトークン数推定（実際の実装ではより正確なカウンターを使用することをお勧めします）
    return msgs.reduce((acc, msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      return acc + content.length / 4; // おおよそ4文字で1トークンと仮定
    }, 0);
  },
  includeSystem: false, // システムメッセージを含めない（重要な変更）
  allowPartial: false,
  startOn: "human",
});

// シーンデータを抽出する関数
export const extractSceneData = (text: string): string | null => {
  const jsonRegex = /```json\n([\s\S]*?)```/;
  const match = text.match(jsonRegex);

  if (match && match[1]) {
    try {
      // JSONの検証 - parse without storing the result
      JSON.parse(match[1]);
      return match[1];
    } catch (e) {
      console.error("Invalid JSON in AI response:", e);
      // 無効なJSONの場合、修正を試みる
      try {
        const fixedJson = attemptToFixJson(match[1]);
        if (fixedJson) return fixedJson;
      } catch (fixError) {
        console.error("Failed to fix JSON:", fixError);
      }
      return null;
    }
  }

  return null;
};

// JSONの修正を試みる関数
function attemptToFixJson(jsonStr: string): string | null {
  try {
    // 基本的な修正を試みる
    let fixedJson = jsonStr
      .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // プロパティ名をダブルクォートで囲む
      .replace(/'/g, '"'); // シングルクォートをダブルクォートに置換

    // 末尾のカンマを修正
    fixedJson = fixedJson.replace(/,(\s*[}\]])/g, "$1");

    // 修正したJSONを検証
    JSON.parse(fixedJson);
    return fixedJson;
  } catch {
    return null;
  }
}

// AIの応答を処理して、シーンデータを含むコンテンツを返す
export const formatAIResponseWithSceneData = (
  content: string,
  sceneData: string | null
): string => {
  if (!sceneData) return content;

  // JSONブロックがすでに含まれているかチェック
  const hasJsonBlock = /```json\n[\s\S]*?```/.test(content);

  if (hasJsonBlock) {
    // JSONブロックがすでに含まれている場合はそのまま返す
    return content;
  } else {
    // JSONブロックを追加
    return `${content}\n\n\`\`\`json\n${sceneData}\n\`\`\``;
  }
};

// モデルの初期化
export const initializeModel = () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    maxOutputTokens: 2048,
    temperature: 0.7,
    // 構造化出力のためのオプション設定
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
    ],
  });

  return model;
};

// 次のステップを決定するための条件関数
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const messages = state.messages;
  if (!messages.length) return END;

  // ここでは単純なワークフローなのでAIからの応答後は終了
  return END;
}

// ワークフローの作成
const createWorkflow = (lastSceneData?: string | null) => {
  const model = initializeModel();

  // StateGraphの作成とノードの追加
  const stateGraph = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      // システムメッセージを設定
      const systemContent = SYSTEM_MESSAGE;

      // まず、入力メッセージからSystemMessageを完全に取り除く
      const filteredMessages = state.messages.filter(
        (msg) => !(msg instanceof SystemMessage)
      );

      // メッセージの履歴を管理（トリミング）
      const trimmedMessages = await trimmer.invoke(filteredMessages);

      // プロンプトテンプレートの作成 - システムメッセージを1つにまとめる
      let messages: BaseMessage[] = [];

      // 全てのシステムメッセージを1つに統合する
      let systemMessageContent =
        systemContent +
        "\n\n最後に必ず3DシーンのためのJSON形式のデータを```json```ブロックで提供してください。既存のオブジェクトは保持したまま変更や追加を行ってください。";

      // 現在のシーンオブジェクトがある場合、それも同じシステムメッセージに統合
      if (lastSceneData) {
        systemMessageContent += `\n\n以下が現在のシーンデータです。ユーザーが特に削除を指示しない限り、これらのオブジェクトを保持してください：\n\n\`\`\`json\n${lastSceneData}\n\`\`\``;
      }

      // 統合した1つのシステムメッセージを最初に追加
      messages.push(new SystemMessage(systemMessageContent));

      // その後にユーザーとAIのメッセージを追加
      messages = [...messages, ...trimmedMessages];

      // モデルからの応答を取得
      const response = await model.invoke(messages);

      // シーンデータを抽出
      let content = response.content as string;
      let sceneData = extractSceneData(content);

      // シーンデータが見つからない場合、フォローアップリクエストを送信
      if (!sceneData) {
        console.log(
          "シーンデータが見つかりません。フォローアップリクエストを送信します。"
        );
        const followUpPrompt = ChatPromptTemplate.fromMessages([
          new SystemMessage(
            "前回の応答からシーンデータを抽出できませんでした。以下の応答を3Dシーン用のJSONデータに変換してください。必ず```json```ブロックで囲んでください。",
            { caches_control: { type: "ephemeral" } }
          ),
          new HumanMessage(content),
        ]);

        const formattedFollowUpPrompt = await followUpPrompt.invoke({});
        const followUpResponse = await model.invoke(formattedFollowUpPrompt);
        const followUpContent = followUpResponse.content as string;
        sceneData = extractSceneData(followUpContent);

        // フォローアップで取得できた場合、元の内容に追加
        if (sceneData) {
          content = formatAIResponseWithSceneData(content, sceneData);
        }
      }

      // 応答を返す
      const aiMessage = new AIMessage({
        content: content,
      });

      return {
        messages: [aiMessage],
      };
    })
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("agent", END);

  return stateGraph;
};

// キャッシングヘッダーを追加する関数
const addCachingHeaders = (messages: BaseMessage[]): BaseMessage[] => {
  if (!messages.length) return messages;

  const cachedMessages = [...messages];

  // ヘルパー関数：キャッシュ制御を追加
  const addCache = (message: BaseMessage) => {
    if (typeof message.content === "string") {
      message.content = [
        {
          type: "text",
          text: message.content,
          cache_control: { type: "ephemeral" },
        },
      ];
    }
  };

  // 最後のメッセージをキャッシュ
  addCache(cachedMessages.at(-1)!);

  // 2回目のヒューマンメッセージを探してキャッシュ
  let humanCount = 0;
  for (let i = cachedMessages.length - 1; i >= 0; i--) {
    if (cachedMessages[i] instanceof HumanMessage) {
      humanCount++;
      if (humanCount === 2) {
        addCache(cachedMessages[i]);
        break;
      }
    }
  }

  return cachedMessages;
};

// 質問を送信してストリームを取得する関数
export const submitQuestion = async (
  messages: BaseMessage[],
  chatId: string,
  lastSceneData?: string | null
) => {
  // メッセージからシステムメッセージを除外（メッセージ順序の問題を回避）
  const filteredMessages = messages.filter(
    (msg) => !(msg instanceof SystemMessage)
  );

  // キャッシュヘッダーを追加
  const cachedMessages = addCachingHeaders(filteredMessages);

  // ワークフローの作成（最新のシーンデータを渡す）
  const workflow = createWorkflow(lastSceneData);

  // チェックポインターの作成（メモリセーバー）
  const checkpointer = new MemorySaver();
  const app = workflow.compile({ checkpointer });

  // グラフを実行してストリームを取得
  const stream = await app.streamEvents(
    { messages: cachedMessages },
    {
      version: "v2",
      configurable: {
        thread_id: chatId,
      },
      streamMode: "values",
      runId: chatId,
    }
  );

  // ストリームを返す
  return stream;
};
