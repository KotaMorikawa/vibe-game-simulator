# Vibe Game Simulator

AIチャットと3Dシーンビューワーを組み合わせた対話型ゲームシミュレーターです。

## 概要

このアプリケーションは、AIとのチャットインターフェースを通じて3Dシーンを作成・操作できるシミュレーターです。ユーザーはAIにテキストで指示を出すことで、リアルタイムに3Dシーンを変更することができます。

## 主な機能

- AIとのチャットインターフェース
- リアルタイム3Dシーンビューワー
- テキスト指示による3Dオブジェクトの生成と操作
- オブジェクトの色、位置、回転、スケールの制御
- JSONデータのエクスポート機能

## 技術スタック

- Next.js 15.3.1
- React 19
- Three.js / React Three Fiber
- Google Generative AI API
- Tailwind CSS

## セットアップ

### 必要条件

- Node.js 18.x以上
- npm または yarn

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

`.env.local`ファイルをプロジェクトルートに作成し、必要なAPIキーを設定してください：

```
GOOGLE_API_KEY=your_google_api_key_here
```

### 開発サーバーの起動

```bash
npm run dev
# または
yarn dev
```

[http://localhost:3000](http://localhost:3000)にアクセスしてアプリケーションを確認できます。

## 使い方

1. AIチャットインターフェースで指示を入力します（例：「赤い球と青い立方体を配置して」）
2. AIが指示を処理し、3Dシーンに反映します
3. 3Dビューワーでシーンを確認、マウスでカメラを操作できます
4. シーンのJSONデータを表示・コピーすることもできます

## ライセンス

MIT

## 作者

[Kota Morikawa](https://github.com/KotaMorikawa)
