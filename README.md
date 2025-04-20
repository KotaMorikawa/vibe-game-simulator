# Vibe Game Simulator

AI チャットと 3D シーンビューワーを組み合わせた対話型ゲームシミュレーターです。

## 概要

このアプリケーションは、AI とのチャットインターフェースを通じて 3D シーンを作成・操作できるシミュレーターです。ユーザーは AI にテキストで指示を出すことで、リアルタイムに 3D シーンを変更することができます。

## 主な機能

- AI とのチャットインターフェース
- リアルタイム 3D シーンビューワー
- テキスト指示による 3D オブジェクトの生成と操作
- オブジェクトの色、位置、回転、スケールの制御
- JSON データのエクスポート機能

## 技術スタック

- Next.js 15.3.1
- React 19
- Three.js / React Three Fiber
- Google Generative AI API
- Tailwind CSS

## セットアップ

### 必要条件

- Node.js 18.x 以上
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

`.env.local`ファイルをプロジェクトルートに作成し、必要な API キーを設定してください：

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

1. AI チャットインターフェースで指示を入力します（例：「赤い球と青い立方体を配置して」）
2. AI が指示を処理し、3D シーンに反映します
3. 3D ビューワーでシーンを確認、マウスでカメラを操作できます
4. シーンの JSON データを表示・コピーすることもできます

## ライセンス

MIT

## 作者

[Kota Morikawa](https://github.com/KotaMorikawa)
