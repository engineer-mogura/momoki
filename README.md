# Momoki Bar - 注文管理システム

LINEログインを入口にした、バーのメニュー閲覧・注文・注文履歴・店側注文管理ができるWebアプリです

## 技術構成

| レイヤー | 技術 | ローカル | 本番 |
|---------|------|----------|------|
| フロント | Next.js 14 | Docker | Vercel |
| API | Laravel 11 | Docker | Railway |
| DB | PostgreSQL 16 | Docker | Supabase |

## ディレクトリ構成

```
momoki/
├── apps/
│   ├── web/                    # Next.js フロントエンド
│   └── api/                    # Laravel API
│       └── docker/             # API用エントリポイント
│           └── entrypoint.sh
├── infra/
│   └── docker/                 # Dockerファイル
│       ├── api/Dockerfile
│       └── web/Dockerfile
├── docs/                       # ドキュメント
├── docker-compose.yml
└── README.md
```

> **Docker Build Context**: API の build context は `./apps/api`、Dockerfile は `infra/docker/api/Dockerfile` を参照。COPY コマンドは apps/api からの相対パスで解決されます。

## ローカル開発環境のセットアップ (Windows)

### 前提条件

- Docker Desktop for Windows
- Git

> **Note**: PHP/Composer/Node.js のローカルインストールは不要です。すべてDockerコンテナ内で実行されます。

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd momoki
```

### 2. 環境変数の設定（必須）

> **重要**: `.env` ファイルは Docker 起動前に必ず作成してください。ないとコンテナが起動しません。

**PowerShell の場合:**
```powershell
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local
```

**コマンドプロンプト (cmd) の場合:**
```cmd
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env.local
```

**Git Bash / WSL の場合:**
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 3. API の .env を編集

`apps/api/.env` を開いて LINE Login の設定を追加:

```env
# LINE Login (LINE Developers で取得)
LINE_CHANNEL_ID=your_channel_id
LINE_CHANNEL_SECRET=your_channel_secret
LINE_REDIRECT_URI=http://localhost:3000/admin/auth/line/callback

# Admin（招待コード）
ADMIN_INVITE_CODE=your_secret_code
```

> **Note**: `APP_KEY` は初回起動時に自動生成されます。

### 4. Web の .env.local を編集

`apps/web/.env.local` を開いて設定:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_LINE_CHANNEL_ID=your_channel_id
NEXT_PUBLIC_LINE_REDIRECT_URI=http://localhost:3000/admin/auth/line/callback
```

### 5. Docker起動（初回ビルド含む）

```bash
docker compose up -d --build
```

初回起動時、entrypoint が自動で以下を実行します:
- `composer install` で依存パッケージをインストール
- `APP_KEY` が空なら自動生成
- キャッシュクリア（config/cache/route/view）

> **注意**: `.env` ファイルは手順2で事前に作成しておく必要があります。ないとコンテナが起動しません。

### 6. コンテナのログを確認

```bash
docker compose logs -f api
```

`[entrypoint] Starting Laravel development server...` と表示されれば準備完了です。

### 7. マイグレーションとシード

```bash
docker compose exec api php artisan migrate
docker compose exec api php artisan db:seed
```

### 8. アクセス

- フロント: http://localhost:3000
- API: http://localhost:8000
- API ヘルスチェック: http://localhost:8000/api/health

### トラブルシューティング

#### vendor が見つからないエラー

```bash
# ボリュームを削除して再ビルド
docker compose down -v
docker compose up -d --build
```

#### コンテナが起動しない場合

```bash
# ログを確認
docker compose logs api

# コンテナを再起動
docker compose restart api
```

#### Windows でファイル変更が反映されない

Docker Desktop の Settings → Resources → WSL Integration を確認してください。

#### 419 CSRF token mismatch エラー（LINEログイン時）

LINEログイン callback で 419 エラーが出る場合、キャッシュをクリアしてください：

```bash
docker compose exec api php artisan optimize:clear
docker compose restart api
```

> **Note**: LINE OAuth callback は `state` パラメータと PKCE で保護されているため、Laravel の CSRF 検証から除外しています（`bootstrap/app.php`）。

### 9. 動作確認（LINEログインまで）

セットアップ完了後、以下の手順でLINEログインの動作を確認できます。

1. **APIヘルスチェック**
   ```bash
   curl http://localhost:8000/api/health
   # {"status":"ok"} が返ればOK
   ```

2. **フロントアクセス**
   - http://localhost:3000 をブラウザで開く
   - 「LINEでログイン」ボタンをクリック

3. **LINEログインフロー確認**
   - LINE認証画面にリダイレクトされる
   - LINEアカウントでログイン
   - `http://localhost:3000/admin/auth/line/callback?code=...` に戻る
   - ホーム画面に遷移し、ユーザー名が表示されればOK

4. **ネットワーク確認（開発者ツール）**
   - F12 → Network タブ
   - `/api/auth/line/callback` への POST が 200 で返っているか確認
   - `/api/auth/user` への GET でユーザー情報が取得できているか確認

> **Note**: LINE Developers で Callback URL に `http://localhost:3000/admin/auth/line/callback` を登録しておく必要があります。

### 10. 管理者登録の動作確認

まず DB をリセットしてダミー注文を作成:
```bash
docker compose exec api php artisan migrate:fresh
docker compose exec api php artisan db:seed
docker compose exec api php artisan optimize:clear
curl http://localhost:8000/api/health
```

確認フロー:
1. http://localhost:3000 でLINEログイン
2. http://localhost:3000/admin にアクセス → `/admin/setup` にリダイレクト
3. `apps/api/.env` の `ADMIN_INVITE_CODE` の値を入力して「登録」
4. 管理者に昇格し `/admin`（注文一覧 + ダミーデータ）が表示される
5. ステータスボタン（提供済み / 会計済み / 取消）で注文状態を更新できる

チェックポイント:
- 未ログインで `/admin` → `/` にリダイレクト
- 未ログインで `POST /api/admin/setup` → 401
- 一般ユーザーで `GET /api/admin/orders` → 403
- 管理者で `GET /api/admin/orders` → 200

> **重要**: `ADMIN_INVITE_CODE` を変更した場合は `docker compose exec api php artisan optimize:clear` を実行してください（config キャッシュの反映）。

> **本番注意**: `ADMIN_INVITE_CODE=changeme` のまま本番運用しないでください。必ず推測困難な値に変更してください。

## LINE Developers 設定

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. 新規プロバイダー作成 → 新規チャネル作成（LINE Login）
3. 「LINE Login設定」で以下を設定:
   - コールバックURL:
     - ローカル: `http://localhost:3000/admin/auth/line/callback`
     - 本番: `https://yourapp.vercel.app/admin/auth/line/callback`
4. 「チャネル基本設定」からチャネルID、チャネルシークレットを取得

## 環境変数一覧

### 必須ENVチェックリスト

LINEログイン〜注文までの動作に必要な環境変数の一覧です。

#### Laravel API (apps/api/.env)

| 変数名 | 必須 | ローカル例 | 本番例 | 説明 |
|--------|:----:|-----------|--------|------|
| APP_KEY | ✅ | (自動生成) | `base64:...` | 暗号化キー |
| APP_URL | ✅ | `http://localhost:8000` | `https://yourapi.up.railway.app` | APIのURL |
| FRONTEND_URL | | `http://localhost:3000` | `https://yourapp.vercel.app` | フロントURL |
| DB_CONNECTION | ✅ | `pgsql` | `pgsql` | DB種別 |
| DB_HOST | ✅ | `postgres` | - | DBホスト |
| DB_PORT | ✅ | `5432` | - | DBポート |
| DB_DATABASE | ✅ | `momoki` | - | DB名 |
| DB_USERNAME | ✅ | `momoki` | - | DBユーザー |
| DB_PASSWORD | ✅ | `secret` | - | DBパスワード |
| DATABASE_URL | | - | `postgresql://...` | 本番DB接続URL |
| SESSION_DRIVER | ✅ | `cookie` | `cookie` | セッション保存先 |
| SESSION_SECURE_COOKIE | ✅ | `false` | `true` | HTTPS時のみCookie |
| SESSION_SAME_SITE | ✅ | `lax` | `none` | クロスサイトCookie |
| SANCTUM_STATEFUL_DOMAINS | ✅ | `localhost:3000` | `yourapp.vercel.app` | SPA認証ドメイン |
| CORS_ALLOWED_ORIGINS | ✅ | `http://localhost:3000` | `https://yourapp.vercel.app` | CORS許可 |
| LINE_CHANNEL_ID | ✅ | `1234567890` | `1234567890` | LINEチャネルID |
| LINE_CHANNEL_SECRET | ✅ | `xxxxxxxx` | `xxxxxxxx` | LINEシークレット |
| LINE_REDIRECT_URI | ✅ | `http://localhost:3000/admin/auth/line/callback` | `https://yourapp.vercel.app/admin/auth/line/callback` | コールバックURL |
| ADMIN_INVITE_CODE | ✅ | `changeme` | `(任意の文字列)` | 管理者招待コード |

#### Next.js Web (apps/web/.env.local)

| 変数名 | 必須 | ローカル例 | 本番例 | 説明 |
|--------|:----:|-----------|--------|------|
| NEXT_PUBLIC_API_BASE_URL | ✅ | `http://localhost:8000` | `https://momoki-production.up.railway.app` | APIベースURL |
| NEXT_PUBLIC_LINE_CHANNEL_ID | ✅ | `1234567890` | `1234567890` | LINEチャネルID |
| NEXT_PUBLIC_LINE_REDIRECT_URI | ✅ | `http://localhost:3000/admin/auth/line/callback` | `https://yourapp.vercel.app/admin/auth/line/callback` | コールバックURL |
| NEXT_PUBLIC_ADMIN_SETUP_ENABLED | | `true` | `false` | 管理者登録の表示制御 |

### 本番（クロスドメイン）Cookie設定の注意

Vercel（フロント）と Railway（API）はドメインが異なるため、クロスサイトCookieの設定が必須です：

```env
# Railway (API) 側で必須
SESSION_SECURE_COOKIE=true   # HTTPS必須
SESSION_SAME_SITE=none       # クロスサイト許可
```

Next.js側では `fetch` に `credentials: 'include'` を指定（実装済み）。

## 本番デプロイ

### Supabase (データベース)

1. [Supabase](https://supabase.com/) でプロジェクト作成
2. Settings → Database → Connection string (URI) をコピー
3. RailwayのDATABASE_URLに設定

### Railway (API)

1. [Railway](https://railway.app/) でプロジェクト作成
2. GitHubリポジトリを接続（apps/apiディレクトリ）
3. 環境変数を設定:
   ```
   APP_KEY=base64:...
   APP_URL=https://yourapi.up.railway.app
   DATABASE_URL=postgresql://...
   SESSION_DRIVER=cookie
   SESSION_SECURE_COOKIE=true
   SESSION_SAME_SITE=none
   SANCTUM_STATEFUL_DOMAINS=yourapp.vercel.app
   CORS_ALLOWED_ORIGINS=https://yourapp.vercel.app
   LINE_CHANNEL_ID=...
   LINE_CHANNEL_SECRET=...
   LINE_REDIRECT_URI=https://yourapp.vercel.app/admin/auth/line/callback
   ```
4. マイグレーション実行（Railway Shell）:
   ```bash
   php artisan migrate
   php artisan db:seed
   ```

### Vercel (フロント)

1. [Vercel](https://vercel.com/) でプロジェクト作成
2. GitHubリポジトリを接続
3. Root Directory: `apps/web`
4. 環境変数を設定:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://momoki-production.up.railway.app
   NEXT_PUBLIC_LINE_CHANNEL_ID=...
   NEXT_PUBLIC_LINE_REDIRECT_URI=https://yourapp.vercel.app/admin/auth/line/callback
   ```

## CORS / Cookie 設定（本番）

クロスドメインでCookieを使うための設定:

### Laravel側

```php
// config/session.php
'secure' => true,           // HTTPS必須
'same_site' => 'none',      // クロスサイト許可

// config/cors.php
'supports_credentials' => true,
'allowed_origins' => ['https://yourapp.vercel.app'],
```

### Next.js側

```typescript
// fetch時にcredentialsを含める
fetch(url, { credentials: 'include' })
```

## DB設計

### ER図

```
users
├── id
├── line_subject (unique)
├── display_name
├── picture_url
├── is_admin
└── timestamps

stores
├── id
├── name
├── slug (unique)
├── description
├── address
├── phone
├── is_active
└── timestamps

menu_categories
├── id
├── store_id (FK)
├── name
├── description
├── sort_order
├── is_active
└── timestamps

menu_items
├── id
├── menu_category_id (FK)
├── name
├── description
├── price
├── image_url
├── sort_order
├── is_available
├── is_active
└── timestamps

visits
├── id
├── user_id (FK)
├── store_id (FK)
├── table_number
├── checked_in_at
├── checked_out_at
└── timestamps

orders
├── id
├── visit_id (FK)
├── user_id (FK)
├── store_id (FK)
├── status (preparing/served/paid/cancelled)
├── total_amount
├── notes
└── timestamps

order_items
├── id
├── order_id (FK)
├── menu_item_id (FK)
├── menu_item_name
├── price
├── quantity
├── subtotal
└── timestamps
```

## API エンドポイント

### 認証

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | /api/auth/line/callback | LINEログイン処理 |
| POST | /api/auth/logout | ログアウト |
| GET | /api/auth/user | 現在のユーザー取得 |

### メニュー（公開）

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | /api/menu-categories | カテゴリ一覧（商品含む） |
| GET | /api/menu-categories/{id} | カテゴリ詳細 |
| GET | /api/menu-items | 商品一覧 |
| GET | /api/menu-items/{id} | 商品詳細 |

### 注文（要認証）

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | /api/visits/checkin | チェックイン |
| GET | /api/visits/current | 現在の訪問取得 |
| POST | /api/visits/checkout | チェックアウト |
| GET | /api/orders | 注文履歴 |
| POST | /api/orders | 注文作成 |
| GET | /api/orders/{id} | 注文詳細 |

### 管理（要認証・管理者）

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | /api/admin/setup | 管理者登録（招待コード） |
| GET | /api/admin/orders | 注文一覧 |
| PATCH | /api/admin/orders/{id}/status | ステータス更新 |
| GET/POST/PUT/DELETE | /api/admin/menu-categories | カテゴリCRUD |
| GET/POST/PUT/DELETE | /api/admin/menu-items | 商品CRUD |

## ライセンス

MIT
