<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    /**
     * Handle LINE OAuth callback
     * Receives authorization code from frontend, exchanges for tokens, and creates/updates user
     */
    public function lineCallback(Request $request): JsonResponse
    {
        Log::info('lineCallback start', [
            'has_code' => (bool) $request->input('code'),
            'has_code_verifier' => (bool) $request->input('code_verifier'),
            'redirect_uri' => config('services.line.redirect_uri'),
            'client_id' => config('services.line.client_id'),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'referer' => $request->header('referer'),
            'origin' => $request->header('origin'),
        ]);

        $request->validate([
            'code' => 'required|string',
            'code_verifier' => 'required|string', // PKCE
        ]);

        // Exchange code for tokens
        $tokenResponse = Http::asForm()->post('https://api.line.me/oauth2/v2.1/token', [
            'grant_type' => 'authorization_code',
            'code' => $request->code,
            'redirect_uri' => config('services.line.redirect_uri'),
            'client_id' => config('services.line.client_id'),
            'client_secret' => config('services.line.client_secret'),
            'code_verifier' => $request->code_verifier,
        ]);

        if (!$tokenResponse->successful()) {
            Log::warning('lineCallback token exchange failed', [
                'status' => $tokenResponse->status(),
                'body' => $tokenResponse->json(),
            ]);
            return response()->json([
                'error' => 'Failed to exchange code for tokens',
                'details' => $tokenResponse->json(),
            ], 400);
        }

        $tokens = $tokenResponse->json();
        $idToken = $tokens['id_token'] ?? null;

        if (!$idToken) {
            Log::warning('lineCallback missing id_token', [
                'tokens_keys' => array_keys($tokens),
            ]);
            return response()->json(['error' => 'No id_token received'], 400);
        }

        // Verify and decode ID token
        $verifyResponse = Http::asForm()->post('https://api.line.me/oauth2/v2.1/verify', [
            'id_token' => $idToken,
            'client_id' => config('services.line.client_id'),
        ]);

        if (!$verifyResponse->successful()) {
            Log::warning('lineCallback verify failed', [
                'status' => $verifyResponse->status(),
                'body' => $verifyResponse->json(),
            ]);
            return response()->json([
                'error' => 'Failed to verify id_token',
                'details' => $verifyResponse->json(),
            ], 400);
        }

        $profile = $verifyResponse->json();
        $lineSubject = $profile['sub'] ?? null;

        if (!$lineSubject) {
            Log::warning('lineCallback missing sub', [
                'profile' => $profile,
            ]);
            return response()->json(['error' => 'No sub in id_token'], 400);
        }

        // Create or update user
        $user = User::updateOrCreate(
            ['line_subject' => $lineSubject],
            [
                'display_name' => $profile['name'] ?? null,
                'picture_url' => $profile['picture'] ?? null,
            ]
        );

        // 同名トークンのみ更新（全端末ログアウトを避ける）
        $user->tokens()->where('name', 'liff')->delete();

        // Create a new Personal Access Token
        $token = $user->createToken('liff')->plainTextToken;

        Log::info('lineCallback success', [
            'user_id' => $user->id,
            'display_name' => $user->display_name,
        ]);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'picture_url' => $user->picture_url,
                'is_admin' => $user->is_admin,
            ],
            'token' => $token,
        ]);
    }

    /**
     * Logout current user (revoke current token)
     */
    public function logout(Request $request): JsonResponse
    {
        // Revoke the current access token
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * Get current authenticated user
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'picture_url' => $user->picture_url,
                'is_admin' => $user->is_admin,
            ],
        ]);
    }
}
