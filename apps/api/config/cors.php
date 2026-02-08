<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Bearer Token認証用のCORS設定
    | Cookieは使わないので supports_credentials は false
    | Authorization ヘッダーを許可
    |
    */

    'paths' => ['api/*', 'auth/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter(array_merge(
        array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000'))),
        [
            // Vercel production (exact match)
            'https://momoki.vercel.app',
        ]
    ), fn ($v) => $v !== '')))),

    // 本番だけ確実に通す（patterns は一旦使わない）
    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
