<?php

namespace Database\Seeders;

use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Store;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create admin user
        $admin = User::firstOrCreate(
            ['line_subject' => 'admin_placeholder'],
            ['display_name' => 'Admin', 'is_admin' => true]
        );

        // Create store
        $store = Store::firstOrCreate(
            ['slug' => 'momoki'],
            ['name' => 'Momoki Bar', 'description' => 'Welcome to Momoki Bar', 'is_active' => true]
        );

        // Seed menu categories and items (with theme support)
        $this->call([
            MenuCategorySeeder::class,
            MenuItemSeeder::class,
        ]);

        // OLD: Inline menu data (deprecated in favor of separate seeders)
        /*
        $categories = [
            [
                'name' => 'ウイスキー',
                'description' => 'シングルモルト・ブレンデッド',
                'items' => [
                    ['name' => '山崎12年', 'price' => 1500, 'description' => 'サントリー シングルモルト'],
                    ['name' => '白州12年', 'price' => 1400, 'description' => 'サントリー シングルモルト'],
                    ['name' => '響 ジャパニーズハーモニー', 'price' => 1600, 'description' => 'サントリー ブレンデッド'],
                    ['name' => 'マッカラン12年', 'price' => 1300, 'description' => 'スコッチ シングルモルト'],
                    ['name' => 'ボウモア12年', 'price' => 1200, 'description' => 'アイラモルト'],
                ],
            ],
            [
                'name' => 'カクテル',
                'description' => '定番カクテル',
                'items' => [
                    ['name' => 'ジントニック', 'price' => 800, 'description' => 'ジン + トニックウォーター'],
                    ['name' => 'モスコミュール', 'price' => 800, 'description' => 'ウォッカ + ジンジャービア + ライム'],
                    ['name' => 'カシスオレンジ', 'price' => 750, 'description' => 'カシスリキュール + オレンジジュース'],
                    ['name' => 'ハイボール', 'price' => 700, 'description' => 'ウイスキー + ソーダ'],
                    ['name' => 'マティーニ', 'price' => 900, 'description' => 'ジン + ドライベルモット'],
                ],
            ],
            [
                'name' => 'ビール',
                'description' => '生ビール・瓶ビール',
                'items' => [
                    ['name' => 'プレミアムモルツ（生）', 'price' => 650, 'description' => 'サントリー'],
                    ['name' => 'ギネス（生）', 'price' => 800, 'description' => 'アイリッシュスタウト'],
                    ['name' => 'ハイネケン', 'price' => 700, 'description' => '瓶'],
                    ['name' => 'コロナ', 'price' => 700, 'description' => '瓶'],
                ],
            ],
            [
                'name' => 'ソフトドリンク',
                'description' => 'ノンアルコール',
                'items' => [
                    ['name' => 'ウーロン茶', 'price' => 400, 'description' => ''],
                    ['name' => 'オレンジジュース', 'price' => 450, 'description' => ''],
                    ['name' => 'コーラ', 'price' => 400, 'description' => ''],
                    ['name' => 'ジンジャーエール', 'price' => 400, 'description' => ''],
                ],
            ],
            [
                'name' => 'フード',
                'description' => 'おつまみ・軽食',
                'items' => [
                    ['name' => 'ミックスナッツ', 'price' => 500, 'description' => ''],
                    ['name' => 'チーズ盛り合わせ', 'price' => 900, 'description' => '3種のチーズ'],
                    ['name' => '生ハム', 'price' => 800, 'description' => 'イタリア産'],
                    ['name' => 'オリーブ', 'price' => 450, 'description' => 'グリーンオリーブ'],
                    ['name' => 'ドライフルーツ', 'price' => 550, 'description' => ''],
                ],
            ],
        ];

        $sortOrder = 0;
        foreach ($categories as $categoryData) {
            $category = MenuCategory::firstOrCreate(
                ['store_id' => $store->id, 'name' => $categoryData['name']],
                ['description' => $categoryData['description'], 'sort_order' => $sortOrder++, 'is_active' => true]
            );

            $itemSortOrder = 0;
            foreach ($categoryData['items'] as $itemData) {
                MenuItem::firstOrCreate(
                    ['menu_category_id' => $category->id, 'name' => $itemData['name']],
                    [
                        'description' => $itemData['description'],
                        'price' => $itemData['price'],
                        'sort_order' => $itemSortOrder++,
                        'is_available' => true,
                        'is_active' => true,
                    ]
                );
            }
        }
        */

        // ダミー注文データ（管理画面UI確認用）
        $this->seedDummyOrders($admin, $store);
    }

    private function seedDummyOrders(User $user, Store $store): void
    {
        if (Order::exists()) {
            return;
        }

        $menuItems = MenuItem::limit(6)->get();
        if ($menuItems->isEmpty()) {
            return;
        }

        $visit = Visit::create([
            'user_id' => $user->id,
            'store_id' => $store->id,
            'table_number' => '1',
            'checked_in_at' => now()->subHours(2),
        ]);

        $statuses = ['preparing', 'preparing', 'served', 'paid'];

        foreach ($statuses as $i => $status) {
            $order = Order::create([
                'visit_id' => $visit->id,
                'user_id' => $user->id,
                'store_id' => $store->id,
                'status' => $status,
                'total_amount' => 0,
                'created_at' => now()->subMinutes(30 - $i * 8),
            ]);

            $total = 0;
            $picked = $menuItems->random(min($menuItems->count(), rand(2, 3)));
            foreach ($picked as $mi) {
                $qty = rand(1, 2);
                OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $mi->id,
                    'menu_item_name' => $mi->name,
                    'price' => $mi->price,
                    'quantity' => $qty,
                    'subtotal' => $mi->price * $qty,
                ]);
                $total += $mi->price * $qty;
            }

            $order->update(['total_amount' => $total]);
        }
    }
}
