<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SetupController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'invite_code' => 'required|string',
        ]);

        $user = $request->user();
        $expected = config('services.admin.invite_code');

        Log::info('admin/setup attempt', [
            'user_id' => $user->id,
            'invite_code_configured' => !empty($expected),
        ]);

        if (empty($expected)) {
            Log::warning('admin/setup failed: ADMIN_INVITE_CODE not configured');
            return response()->json(['error' => 'Admin setup is not configured'], 500);
        }

        if (!hash_equals($expected, $request->invite_code)) {
            Log::info('admin/setup failed: invalid code', ['user_id' => $user->id]);
            return response()->json(['error' => 'Invalid invite code'], 403);
        }

        $user->is_admin = true;
        $user->save();

        Log::info('admin/setup success', ['user_id' => $user->id]);

        return response()->json([
            'ok' => true,
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'picture_url' => $user->picture_url,
                'is_admin' => $user->is_admin,
            ],
        ]);
    }
}
