<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MenuItemSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Idempotent: truncate and re-insert
        DB::table('menu_items')->truncate();

        $storeId = config('services.store.default_store_id', 1);

        // Get category IDs
        $categories = DB::table('menu_categories')
            ->where('store_id', $storeId)
            ->pluck('id', 'name')
            ->toArray();

        $menuItems = [
            // ビール
            ['category' => 'ビール', 'name' => 'バドワイザー', 'price' => 700, 'order' => 1],
            ['category' => 'ビール', 'name' => 'コロナ', 'price' => 700, 'order' => 2],
            ['category' => 'ビール', 'name' => 'オリオン', 'price' => 700, 'order' => 3],
            ['category' => 'ビール', 'name' => 'アサヒスーパードライ', 'price' => 700, 'order' => 4],
            ['category' => 'ビール', 'name' => 'ノンアルコール', 'price' => 600, 'order' => 5],

            // ハイボール
            ['category' => 'ハイボール', 'name' => 'レギュラー', 'price' => 500, 'order' => 1],
            ['category' => 'ハイボール', 'name' => '角ハイ', 'price' => 600, 'order' => 2],
            ['category' => 'ハイボール', 'name' => 'グランツハイ', 'price' => 600, 'order' => 3],

            // チューハイ
            ['category' => 'チューハイ', 'name' => 'レギュラー', 'price' => 500, 'order' => 1],
            ['category' => 'チューハイ', 'name' => '二階堂', 'price' => 600, 'order' => 2],
            ['category' => 'チューハイ', 'name' => 'キンミヤ', 'price' => 600, 'order' => 3],
            ['category' => 'チューハイ', 'name' => '黒霧ハイ', 'price' => 600, 'order' => 4],
            ['category' => 'チューハイ', 'name' => 'レモンサワー', 'price' => 600, 'order' => 5],

            // カクテル
            ['category' => 'カクテル', 'name' => 'ピーチウーロン', 'price' => 500, 'order' => 1],
            ['category' => 'カクテル', 'name' => 'トマトサワー', 'price' => 600, 'order' => 2],
            ['category' => 'カクテル', 'name' => 'ブルドッグ', 'price' => 700, 'order' => 3],

            // ミルクカクテル
            ['category' => 'ミルクカクテル', 'name' => 'カルアミルク', 'price' => 500, 'order' => 1],
            ['category' => 'ミルクカクテル', 'name' => 'マリブミルク', 'price' => 500, 'order' => 2],
            ['category' => 'ミルクカクテル', 'name' => 'ベイリーズミルク', 'price' => 500, 'order' => 3],
            ['category' => 'ミルクカクテル', 'name' => 'カカオミルク', 'price' => 500, 'order' => 4],
            ['category' => 'ミルクカクテル', 'name' => 'マンゴミルク', 'price' => 500, 'order' => 5],

            // ソフトドリンク
            ['category' => 'ソフトドリンク', 'name' => 'さんぴん茶', 'price' => 400, 'order' => 1],
            ['category' => 'ソフトドリンク', 'name' => 'ウーロン茶', 'price' => 400, 'order' => 2],
            ['category' => 'ソフトドリンク', 'name' => 'コーラ', 'price' => 400, 'order' => 3],
            ['category' => 'ソフトドリンク', 'name' => 'ジンジャエール', 'price' => 400, 'order' => 4],
            ['category' => 'ソフトドリンク', 'name' => 'グレープフルーツ', 'price' => 500, 'order' => 5],
            ['category' => 'ソフトドリンク', 'name' => 'トマトジュース', 'price' => 500, 'order' => 6],
            ['category' => 'ソフトドリンク', 'name' => 'レッドブル', 'price' => 600, 'order' => 7],

            // 泡盛
            ['category' => '泡盛', 'name' => '泡盛 1合', 'price' => 1000, 'order' => 1],

            // 泡盛ボトル
            ['category' => '泡盛ボトル', 'name' => '残波黒', 'price' => 3500, 'order' => 1],
            ['category' => '泡盛ボトル', 'name' => '残波白', 'price' => 3800, 'order' => 2],
            ['category' => '泡盛ボトル', 'name' => '残波プレミアム', 'price' => 4000, 'order' => 3],
            ['category' => '泡盛ボトル', 'name' => '多良川', 'price' => 3500, 'order' => 4],
            ['category' => '泡盛ボトル', 'name' => '菊の露', 'price' => 3500, 'order' => 5],
            ['category' => '泡盛ボトル', 'name' => '久米仙', 'price' => 3500, 'order' => 6],
            ['category' => '泡盛ボトル', 'name' => '琉球王朝', 'price' => 4500, 'order' => 7],
            ['category' => '泡盛ボトル', 'name' => '菊の露VIP', 'price' => 5200, 'order' => 8],
            ['category' => '泡盛ボトル', 'name' => '王朝純金箱入り', 'price' => 5800, 'order' => 9],

            // 焼酎・ウイスキー
            ['category' => '焼酎・ウイスキー', 'name' => '忠幸', 'price' => 4000, 'order' => 1],
            ['category' => '焼酎・ウイスキー', 'name' => '赤霧', 'price' => 4000, 'order' => 2],
            ['category' => '焼酎・ウイスキー', 'name' => '黒霧', 'price' => 4000, 'order' => 3],
            ['category' => '焼酎・ウイスキー', 'name' => '二階堂', 'price' => 4000, 'order' => 4],
            ['category' => '焼酎・ウイスキー', 'name' => 'いいちこ', 'price' => 3800, 'order' => 5],
            ['category' => '焼酎・ウイスキー', 'name' => 'ブラックニッカ', 'price' => 3800, 'order' => 6],
            ['category' => '焼酎・ウイスキー', 'name' => 'サントリーウイスキー', 'price' => 5000, 'order' => 7],

            // ワイン
            ['category' => 'ワイン', 'name' => '赤ワイン（大）', 'price' => 2800, 'order' => 1],
            ['category' => 'ワイン', 'name' => '赤ワイン（小）', 'price' => 800, 'order' => 2],
        ];

        foreach ($menuItems as $item) {
            $categoryId = $categories[$item['category']] ?? null;

            if (!$categoryId) {
                $this->command->warn("Category '{$item['category']}' not found. Skipping '{$item['name']}'.");
                continue;
            }

            DB::table('menu_items')->insert([
                'menu_category_id' => $categoryId,
                'name' => $item['name'],
                'description' => null,
                'price' => $item['price'],
                'sort_order' => $item['order'],
                'is_available' => true,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->command->info('Menu items seeded successfully!');
    }
}
