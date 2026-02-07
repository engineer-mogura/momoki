<?php

return [
    'line' => [
        'client_id' => env('LINE_CLIENT_ID'),
        'client_secret' => env('LINE_CLIENT_SECRET'),
        'redirect_uri' => env('LINE_REDIRECT_URI'),
    ],

    'admin' => [
        'invite_code' => env('ADMIN_INVITE_CODE'),
    ],

    'store' => [
        'default_store_id' => env('DEFAULT_STORE_ID', 1),
    ],

    'business_day' => [
        'start' => env('BUSINESS_DAY_START', '21:00'),
        'timezone' => 'Asia/Tokyo',
    ],
];
