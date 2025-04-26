# Vibe Game Simulator

AI チャットと 3D シーンビューワーを組み合わせた対話型シミュレーターです。

## 概要

このアプリケーションは、AI とのチャットインターフェースを通じて 3D シーンを作成・操作できるシミュレーターです。ユーザーは AI にテキストで指示を出すことで、リアルタイムに 3D シーンを変更することができます。チャット履歴と生成された 3D シーンは Convex データベースに保存され、いつでも過去の会話と作成したシーンに戻ることができます。

## 主な機能

- AI とのチャットインターフェース
- リアルタイム 3D シーンビューワー（Three.js/React Three Fiber）
- テキスト指示による 3D オブジェクトの生成と操作
- オブジェクトの色、位置、回転、スケールの制御
- サーバーサイドのストリーミングレスポンス
- チャット履歴の保存と管理
- JSON データの表示とコピー機能
- 過去のチャットセッションの閲覧と再開

## 技術スタック

- Next.js 15.3.1
- React 19
- Three.js / React Three Fiber / Drei
- Google Gemini AI API (LangChain)
- Convex (バックエンド & データベース)
- Tailwind CSS (UI)
- Server-Sent Events (SSE) for streaming

## セットアップ

### 必要条件

- Node.js 18.x 以上
- npm または yarn
- Convex アカウント
- Google AI Gemini API キー

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/KotaMorikawa/vibe-game-simulator.git
cd vibe-game-simulator

# 依存関係のインストール
npm install
# または
yarn install
```

### 環境変数の設定

`.env.local`ファイルをプロジェクトルートに作成し、必要な API キーを設定してください：

```
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url
```

### Convexの設定

```bash
# Convexをセットアップ
npx convex dev
```

### 開発サーバーの起動

```bash
npm run dev
# または
yarn dev
```

[http://localhost:3000](http://localhost:3000)にアクセスしてアプリケーションを確認できます。

## 使い方

1. トップページからチャットを開始するか、既存のチャットセッションを選択します
2. AI チャットインターフェースで指示を入力します（例：「赤い球と青い立方体を配置して」）
3. AI が指示を処理し、3D シーンに反映します（ストリーミング形式でリアルタイムに応答が表示されます）
4. 3D ビューワーでシーンを確認、マウスでカメラをドラッグして視点を変更できます
5. シーンの JSON データを表示・コピーすることもできます
6. チャット履歴は自動的に保存され、後で続きから再開することができます

## プロジェクト構造

- `src/components` - UI コンポーネント
- `src/lib` - ユーティリティ関数とヘルパー
- `src/app` - Next.js アプリケーションルートとページ
- `convex` - バックエンドロジックとデータモデル
- `constants` - システムプロンプトなどの定数

## ライセンス

MIT

## 作者

[Kota Morikawa](https://github.com/KotaMorikawa)
