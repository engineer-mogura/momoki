<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MenuCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Idempotent: truncate and re-insert
        DB::table('menu_categories')->truncate();

        $categories = [
            // 通常ドリンク (light theme)
            ['name' => 'ビール', 'description' => null, 'theme' => 'light', 'sort_order' => 1],
            ['name' => 'ハイボール', 'description' => null, 'theme' => 'light', 'sort_order' => 2],
            ['name' => 'チューハイ', 'description' => null, 'theme' => 'light', 'sort_order' => 3],
            ['name' => 'カクテル', 'description' => null, 'theme' => 'light', 'sort_order' => 4],
            ['name' => 'ミルクカクテル', 'description' => null, 'theme' => 'light', 'sort_order' => 5],
            ['name' => 'ソフトドリンク', 'description' => null, 'theme' => 'light', 'sort_order' => 6],
            ['name' => '泡盛', 'description' => null, 'theme' => 'light', 'sort_order' => 7],

            // ボトルメニュー (dark theme)
            ['name' => '泡盛ボトル', 'description' => null, 'theme' => 'dark', 'sort_order' => 8],
            ['name' => '焼酎・ウイスキー', 'description' => null, 'theme' => 'dark', 'sort_order' => 9],
            ['name' => 'ワイン', 'description' => null, 'theme' => 'dark', 'sort_order' => 10],
        ];

        $storeId = config('services.store.default_store_id', 1);

        foreach ($categories as $category) {
            DB::table('menu_categories')->insert([
                'store_id' => $storeId,
                'name' => $category['name'],
                'description' => $category['description'],
                'theme' => $category['theme'],
                'sort_order' => $category['sort_order'],
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->command->info('Menu categories seeded successfully!');
    }
}
