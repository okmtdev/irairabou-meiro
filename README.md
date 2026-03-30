# いらぼうでめいろ 🐭

子供向けの迷路ゲームです。ねずみ（いらぼう）をマウスやタッチで操作して、スタートからゴールまで導きましょう！

## ゲームの遊び方

1. タイトル画面で「あそぶ」をクリック
2. ステージを選択（かんたん / ふつう / むずかしい / えくすとら）
3. ねずみ🐭をクリック/タッチしてゲーム開始
4. マウスやタッチでねずみを動かしてゴール（G）を目指す
5. 壁やお邪魔虫🐛に触れるとダメージ（ハートが減る）
6. リンゴ🍎を取るとハートが回復
7. 制限時間60秒以内にゴールしよう！

### ステージ

| ステージ | 難易度 | お邪魔虫 |
|---------|--------|---------|
| かんたん | 小さい迷路 | なし |
| ふつう | 中くらいの迷路 | 2匹（ゆっくり） |
| むずかしい | 大きい迷路 | 4匹（やや速い） |
| えくすとら | とても大きい迷路 | 7匹（速い） |

※「えくすとら」は「むずかしい」をクリアすると解放されます。

## 開発環境のセットアップ

### 必要なもの

- Node.js (v18以上)
- npm

### インストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` が開きます。ファイルを変更すると自動リロードされます。

### ビルド

```bash
npm run build
```

`dist/` ディレクトリにビルド成果物が出力されます。

### ビルドのプレビュー

```bash
npm run preview
```

## Google Cloud Storage へのデプロイ

### 前提条件

- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) がインストール済み
- Google Cloud プロジェクトが作成済み
- 課金が有効化されている

### 1. gcloud の初期設定

```bash
# ログイン
gcloud auth login

# プロジェクトを設定（YOUR_PROJECT_ID を自分のプロジェクトIDに置き換え）
gcloud config set project YOUR_PROJECT_ID
```

### 2. Cloud Storage バケットの作成

```bash
# バケットを作成（BUCKET_NAME を好きな名前に置き換え。グローバルで一意である必要あり）
gcloud storage buckets create gs://BUCKET_NAME --location=asia-northeast1
```

### 3. バケットを公開設定にする

```bash
# 全員がオブジェクトを読めるように IAM ポリシーを設定
gcloud storage buckets add-iam-policy-binding gs://BUCKET_NAME \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

### 4. 静的ウェブサイトの設定

```bash
# メインページとエラーページを設定
gcloud storage buckets update gs://BUCKET_NAME \
  --web-main-page-suffix=index.html \
  --web-error-page=index.html
```

### 5. ビルドしてアップロード

```bash
# ビルド
npm run build

# dist/ の中身をバケットにアップロード
gcloud storage cp -r dist/* gs://BUCKET_NAME/
```

### 6. アクセス

以下のURLでゲームにアクセスできます：

```
https://storage.googleapis.com/BUCKET_NAME/index.html
```

### 更新時のデプロイ

コードを更新した場合は、ビルドして再アップロードするだけです：

```bash
npm run build
gcloud storage cp -r dist/* gs://BUCKET_NAME/
```

キャッシュを無効化したい場合：

```bash
gcloud storage objects update gs://BUCKET_NAME/** \
  --cache-control="no-cache, max-age=0"
```

### カスタムドメインの設定（オプション）

カスタムドメインを使いたい場合は、Cloud Storage の前に Cloud Load Balancing を設定するか、Firebase Hosting を利用することを検討してください。

```bash
# Firebase Hosting を使う場合（より簡単）
npm install -g firebase-tools
firebase init hosting
firebase deploy
```

## 技術構成

- **ビルドツール**: Vite
- **言語**: Vanilla JavaScript (ES Modules)
- **描画**: HTML5 Canvas API
- **音声**: Web Audio API（シンプルな効果音）
- **データ保存**: localStorage（クリア状況の保存）
- **迷路生成**: 再帰バックトラッキングアルゴリズム

## ライセンス

MIT License
