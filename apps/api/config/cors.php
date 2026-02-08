<?php

$env = env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000');
$origins = array_map('trim', explode(',', $env));
$origins = array_filter($origins, function ($v) {
    return $v !== '';
});
$origins[] = 'https://momoki.vercel.app';
$origins = array_values(array_unique($origins));

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

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $origins,

    // 本番だけ確実に通す（patterns は一旦使わない）
    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
