<?php

namespace Database\Seeders;

use App\Models\Store;
use Illuminate\Database\Seeder;

class StoreSeeder extends Seeder
{
    public function run(): void
    {
        // Minimum viable store to satisfy FK (visits/orders/business_sessions)
        Store::firstOrCreate(
            ['slug' => 'momoki'],
            [
                'name' => 'Momoki Bar',
                'description' => 'Welcome to Momoki Bar',
                'is_active' => true,
            ]
        );
    }
}

