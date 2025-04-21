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
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// システムプロンプトの定義
const SYSTEM_MESSAGE = `あなたは3Dゲームシーンを生成するためのアシスタントです。
ユーザーとの会話を元に、魅力的なゲームシーンのアイデアを提案し、それに対応するシーンデータを生成します。
シーンデータはJSONフォーマットで、以下の構造に従ってください：

{
  "scene": {
    "name": "シーンの名前",
    "description": "シーンの説明",
    "objects": [
      {
        "type": "床や壁などのオブジェクトタイプ",
        "position": [x, y, z],
        "rotation": [x, y, z],
        "scale": [x, y, z],
        "color": "カラーコード",
        "properties": {
          // オブジェクト特有のプロパティ
        }
      }
      // 他のオブジェクト...
    ],
    "lighting": {
      "type": "ambient/directional/point",
      "intensity": 0.5 // 0-1の範囲
    },
    "camera": {
      "position": [x, y, z],
      "lookAt": [x, y, z]
    }
  }
}

シーンデータはJSON形式で提供し、それを前後に\`\`\`json\`\`\`で囲んでください。
ユーザーの入力に基づいて、創造的かつ視覚的に魅力的なシーンを生成してください。`;

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
  includeSystem: true,
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
      return null;
    }
  }

  return null;
};

// モデルの初期化
export const initializeModel = (apiKey: string) => {
  const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.0-flash",
    maxOutputTokens: 2048,
    temperature: 0.7,
    streaming: true,
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
const createWorkflow = (apiKey: string) => {
  const model = initializeModel(apiKey);

  // StateGraphの作成とノードの追加
  const stateGraph = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      // システムメッセージを設定
      const systemContent = SYSTEM_MESSAGE;

      // プロンプトテンプレートの作成
      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(systemContent),
        new MessagesPlaceholder("messages"),
      ]);

      // メッセージの履歴を管理（トリミング）
      const trimmedMessages = await trimmer.invoke(state.messages);

      // プロンプトのフォーマット
      const prompt = await promptTemplate.invoke({ messages: trimmedMessages });

      // モデルからの応答を取得
      const response = await model.invoke(prompt);

      // シーンデータを抽出
      const content = response.content as string;
      const sceneData = extractSceneData(content);

      // 応答を返す（カスタムメタデータ付き）
      const aiMessage = new AIMessage({
        content,
        additional_kwargs: {
          scene_data: sceneData,
        },
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
      message.additional_kwargs = {
        ...message.additional_kwargs,
        cache_control: { type: "ephemeral" },
      };
    }
  };

  // 最後のメッセージをキャッシュ
  addCache(cachedMessages[cachedMessages.length - 1]);

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
  apiKey: string
) => {
  // キャッシュヘッダーを追加
  const cachedMessages = addCachingHeaders(messages);

  // ワークフローの作成
  const workflow = createWorkflow(apiKey);

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
