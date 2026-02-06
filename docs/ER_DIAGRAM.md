# ER図 - Momoki Bar データベース設計

## 概要

バーの注文管理システムのデータベース設計です。

## エンティティ関係図

```
┌─────────────┐       ┌─────────────┐
│   stores    │       │    users    │
├─────────────┤       ├─────────────┤
│ id          │       │ id          │
│ name        │       │ line_subject│ (unique)
│ slug        │       │ display_name│
│ description │       │ picture_url │
│ address     │       │ is_admin    │
│ phone       │       │ created_at  │
│ is_active   │       │ updated_at  │
│ created_at  │       └──────┬──────┘
│ updated_at  │              │
└──────┬──────┘              │
       │                     │
       │ 1                   │ 1
       │                     │
       ▼ n                   ▼ n
┌─────────────────┐   ┌─────────────┐
│ menu_categories │   │   visits    │
├─────────────────┤   ├─────────────┤
│ id              │   │ id          │
│ store_id        │◀──│ user_id     │
│ name            │   │ store_id    │
│ description     │   │ table_number│
│ sort_order      │   │ checked_in  │
│ is_active       │   │ checked_out │
│ created_at      │   │ created_at  │
│ updated_at      │   │ updated_at  │
└────────┬────────┘   └──────┬──────┘
         │                   │
         │ 1                 │ 1
         │                   │
         ▼ n                 ▼ n
┌─────────────────┐   ┌─────────────┐
│   menu_items    │   │   orders    │
├─────────────────┤   ├─────────────┤
│ id              │   │ id          │
│ menu_category_id│   │ visit_id    │
│ name            │   │ user_id     │
│ description     │   │ store_id    │
│ price           │   │ status      │
│ image_url       │   │ total_amount│
│ sort_order      │   │ notes       │
│ is_available    │   │ created_at  │
│ is_active       │   │ updated_at  │
│ created_at      │   └──────┬──────┘
│ updated_at      │          │
└────────┬────────┘          │ 1
         │                   │
         │                   ▼ n
         │            ┌─────────────┐
         │            │ order_items │
         │            ├─────────────┤
         │            │ id          │
         └───────────▶│ order_id    │
              n      1│ menu_item_id│
                      │ menu_item_  │
                      │   name      │
                      │ price       │
                      │ quantity    │
                      │ subtotal    │
                      │ created_at  │
                      │ updated_at  │
                      └─────────────┘
```

## テーブル詳細

### users（ユーザー）

LINE認証で作成されるユーザー情報。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | bigint | PK, AUTO_INCREMENT | ユーザーID |
| line_subject | varchar(255) | UNIQUE, NOT NULL | LINE ユーザーID (sub) |
| display_name | varchar(255) | NULLABLE | LINE表示名 |
| picture_url | varchar(255) | NULLABLE | LINEプロフィール画像URL |
| is_admin | boolean | DEFAULT false | 管理者フラグ |
| created_at | timestamp | | 作成日時 |
| updated_at | timestamp | | 更新日時 |

### stores（店舗）

店舗情報。初期は1店舗運用。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | bigint | PK, AUTO_INCREMENT | 店舗ID |
| name | varchar(255) | NOT NULL | 店舗名 |
| slug | varchar(255) | UNIQUE, NOT NULL | URL用スラッグ |
| description | text | NULLABLE | 説明 |
| address | varchar(255) | NULLABLE | 住所 |
| phone | varchar(255) | NULLABLE | 電話番号 |
| is_active | boolean | DEFAULT true | 有効フラグ |
| created_at | timestamp | | 作成日時 |
| updated_at | timestamp | | 更新日時 |

### menu_categories（メニューカテゴリ）

メニューのカテゴリ（ウイスキー、カクテル、フードなど）。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | bigint | PK, AUTO_INCREMENT | カテゴリID |
| store_id | bigint | FK (stores) | 店舗ID |
| name | varchar(255) | NOT NULL | カテゴリ名 |
| description | text | NULLABLE | 説明 |
| sort_order | int | DEFAULT 0 | 表示順 |
| is_active | boolean | DEFAULT true | 有効フラグ |
| created_at | timestamp | | 作成日時 |
| updated_at | timestamp | | 更新日時 |

### menu_items（メニュー商品）

個々のメニュー商品。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | bigint | PK, AUTO_INCREMENT | 商品ID |
| menu_category_id | bigint | FK (menu_categories) | カテゴリID |
| name | varchar(255) | NOT NULL | 商品名 |
| description | text | NULLABLE | 説明 |
| price | int | NOT NULL | 価格（円） |
| image_url | varchar(255) | NULLABLE | 画像URL |
| sort_order | int | DEFAULT 0 | 表示順 |
| is_available | boolean | DEFAULT true | 注文可能フラグ |
| is_active | boolean | DEFAULT true | 有効フラグ |
| created_at | timestamp | | 作成日時 |
| updated_at | timestamp | | 更新日時 |

### visits（来店）

ユーザーの来店セッション。チェックイン/チェックアウトを管理。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | bigint | PK, AUTO_INCREMENT | 来店ID |
| user_id | bigint | FK (users) | ユーザーID |
| store_id | bigint | FK (stores) | 店舗ID |
| table_number | varchar(50) | NULLABLE | 卓番号（将来用） |
| checked_in_at | timestamp | NOT NULL | チェックイン日時 |
| checked_out_at | timestamp | NULLABLE | チェックアウト日時 |
| created_at | timestamp | | 作成日時 |
| updated_at | timestamp | | 更新日時 |

### orders（注文）

注文ヘッダー。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | bigint | PK, AUTO_INCREMENT | 注文ID |
| visit_id | bigint | FK (visits) | 来店ID |
| user_id | bigint | FK (users) | ユーザーID |
| store_id | bigint | FK (stores) | 店舗ID |
| status | varchar(20) | DEFAULT 'NEW' | ステータス |
| total_amount | int | DEFAULT 0 | 合計金額（円） |
| notes | text | NULLABLE | 備考 |
| created_at | timestamp | | 作成日時 |
| updated_at | timestamp | | 更新日時 |

**ステータス値:**
- `NEW`: 新規注文
- `IN_PROGRESS`: 準備中
- `SERVED`: 提供済み
- `PAID`: 会計済み

### order_items（注文明細）

注文の各商品。注文時点の商品名・価格をスナップショットとして保持。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | bigint | PK, AUTO_INCREMENT | 明細ID |
| order_id | bigint | FK (orders) | 注文ID |
| menu_item_id | bigint | FK (menu_items) | 商品ID |
| menu_item_name | varchar(255) | NOT NULL | 商品名（スナップショット） |
| price | int | NOT NULL | 単価（スナップショット） |
| quantity | int | DEFAULT 1 | 数量 |
| subtotal | int | NOT NULL | 小計 |
| created_at | timestamp | | 作成日時 |
| updated_at | timestamp | | 更新日時 |

## インデックス

| テーブル | インデックス | カラム |
|---------|-------------|--------|
| users | UNIQUE | line_subject |
| stores | UNIQUE | slug |
| menu_categories | INDEX | (store_id, sort_order) |
| menu_items | INDEX | (menu_category_id, sort_order) |
| menu_items | INDEX | (is_available, is_active) |
| visits | INDEX | (user_id, store_id, checked_out_at) |
| orders | INDEX | (store_id, status, created_at) |
| orders | INDEX | (user_id, created_at) |
| orders | INDEX | (visit_id) |
| order_items | INDEX | (order_id) |
