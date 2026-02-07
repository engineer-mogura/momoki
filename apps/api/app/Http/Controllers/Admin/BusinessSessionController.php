<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BusinessSession;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BusinessSessionController extends Controller
{
    public function current(): JsonResponse
    {
        $storeId = (int) config('services.store.default_store_id', 1);
        $session = BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->first();

        return response()->json([
            'session' => $session ? $this->formatSession($session) : null,
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        $storeId = (int) config('services.store.default_store_id', 1);
        $tz = config('services.business_day.timezone', 'Asia/Tokyo');

        try {
            $session = DB::transaction(function () use ($request, $storeId, $tz) {
                $existing = BusinessSession::where('store_id', $storeId)
                    ->whereNull('ended_at')
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    return $existing;
                }

                return BusinessSession::create([
                    'store_id' => $storeId,
                    'business_date' => now($tz)->toDateString(),
                    'started_at' => now(),
                    'created_by' => $request->user()?->id,
                ]);
            });
        } catch (QueryException $e) {
            // PostgreSQL unique_violation (partial unique index on open sessions)
            if ($e->getCode() === '23505') {
                $session = BusinessSession::where('store_id', $storeId)
                    ->whereNull('ended_at')
                    ->first();
            } else {
                throw $e;
            }
        }

        return response()->json([
            'message' => '営業を開始しました',
            'session' => $this->formatSession($session),
        ]);
    }

    public function end(): JsonResponse
    {
        $storeId = (int) config('services.store.default_store_id', 1);

        $session = BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->first();

        if (!$session) {
            return response()->json([
                'message' => '営業中のセッションがありません',
            ], 400);
        }

        $session->update(['ended_at' => now()]);

        return response()->json([
            'message' => '営業を終了しました',
            'session' => $this->formatSession($session->fresh()),
        ]);
    }

    private function formatSession(BusinessSession $session): array
    {
        return [
            'id' => $session->id,
            'store_id' => $session->store_id,
            'business_date' => $session->business_date?->toDateString(),
            'started_at' => $session->started_at?->toIso8601String(),
            'ended_at' => $session->ended_at?->toIso8601String(),
        ];
    }
}
