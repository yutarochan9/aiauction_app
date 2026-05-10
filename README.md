# AI Art Auction - AIアート専門オークションマーケットプレイス

Next.js + Supabase + Stripe で構築したMVP。  
AIで生成したアート作品を売買できるオークション形式のマーケットプレイスです。

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS + ダークモード
- **バックエンド・DB**: Supabase (Auth / PostgreSQL / Storage / Realtime)
- **決済**: Stripe（テストモード）
- **多言語**: next-intl（日本語・英語）
- **画像処理**: sharp（透かし・リサイズ）

## 環境構築

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` を編集して各サービスのキーを設定してください：

```env
# Supabase（https://app.supabase.com でプロジェクト作成後に取得）
NEXT_PUBLIC_SUPABASE_URL=          # プロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # anon（公開）キー
SUPABASE_SERVICE_ROLE_KEY=         # service_roleキー（webhookで使用）

# Stripe（https://dashboard.stripe.com でテストキーを取得）
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # pk_test_...
STRIPE_SECRET_KEY=                   # sk_test_...
STRIPE_WEBHOOK_SECRET=               # stripe listen で取得

# アプリURL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Supabaseのセットアップ

1. [Supabase](https://app.supabase.com) でプロジェクトを作成
2. SQL Editorで `supabase/schema.sql` を実行してテーブルを作成
3. Authentication → Providers → Google を有効化
   - Callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. Google Cloud Console でOAuthクライアントIDを作成してSupabaseに設定

### 4. 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` で確認できます。

### 5. Stripe Webhookのローカルテスト

```bash
# Stripe CLIをインストール
stripe listen --forward-to localhost:3000/api/webhook
```

出力された `whsec_...` を `STRIPE_WEBHOOK_SECRET` に設定してください。

## ページ構成

| パス | 説明 |
|------|------|
| `/` | トップ・作品一覧（新着順・終了間近・価格順） |
| `/auction/[id]` | 作品詳細・入札ページ |
| `/sell` | 作品出品ページ |
| `/profile/[id]` | ユーザープロフィール・出品履歴 |
| `/dashboard` | 自分の出品・入札・落札管理 |

## 主な機能

- **Google OAuth** でログイン（Supabase Auth）
- **画像アップロード**: 高解像度オリジナルを非公開保存、透かし入り低解像度を表示
- **リアルタイム入札**: Supabase Realtime でリアルタイム更新
- **残り時間カウントダウン**: 1秒ごとに更新
- **Stripe決済**: 落札額の5%がプラットフォーム手数料
- **購入者固有ID**: 高解像度画像に透かしとして埋め込み
- **SNS認証バッジ**: X/Instagramの投稿で本人確認
- **日英切り替え**: cookieで言語設定を保存

## Vercelへのデプロイ

```bash
# Vercel CLIでデプロイ
npx vercel --prod
```

Vercelのダッシュボードで環境変数を設定してください。  
本番用Stripeキー（`pk_live_...` / `sk_live_...`）に差し替えてから公開してください。
