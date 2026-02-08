<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    protected function redirectTo(Request $request): ?string
    {
        // API は絶対にリダイレクトしない（Route [login] not defined 回避）
        if ($request->expectsJson() || $request->is('api/*')) {
            return null;
        }

        // Momoki はWebログイン画面を持たないので最終的に常に null でOK
        return null;
    }
}
