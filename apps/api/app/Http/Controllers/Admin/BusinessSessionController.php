<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BusinessSession;
use App\Models\Store;
use App\Models\Visit;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BusinessSessionController extends Controller
{
    public function current(): JsonResponse
    {
        $resolved = $this->resolveStoreId();
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }
        $storeId = $resolved;
        $session = BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->first();

        return response()->json([
            'session' => $session ? $this->formatSession($session) : null,
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        // Optional: allow specifying store_id (future multi-store)
        $requestedStoreId = $request->input('store_id');
        if ($requestedStoreId !== null) {
            $requestedStoreId = (int) $requestedStoreId;
            if (!Store::whereKey($requestedStoreId)->exists()) {
                return response()->json([
                    'error' => 'STORE_NOT_FOUND',
                    'message' => '指定された店舗が見つかりません',
                ], 404);
            }
            $storeId = $requestedStoreId;
        } else {
            $resolved = $this->resolveStoreId();
            if ($resolved instanceof JsonResponse) {
                return $resolved;
            }
            $storeId = $resolved;
        }

        $tz = config('services.business_day.timezone', 'Asia/Tokyo');
        $today = now($tz)->toDateString();

        try {
            $session = DB::transaction(function () use ($request, $storeId, $today) {
                // 同一営業日のセッションがあればそれを使う（冪等）
                $existing = BusinessSession::where('store_id', $storeId)
                    ->where('business_date', $today)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    // 終了済みなら再開する
                    if ($existing->ended_at !== null) {
                        $existing->update(['ended_at' => null]);
                    }
                    return $existing;
                }

                return BusinessSession::create([
                    'store_id' => $storeId,
                    'business_date' => $today,
                    'started_at' => now(),
                    'created_by' => $request->user()?->id,
                ]);
            });
        } catch (QueryException $e) {
            // PostgreSQL unique_violation (store_id + business_date)
            if ($e->getCode() === '23505') {
                $session = BusinessSession::where('store_id', $storeId)
                    ->where('business_date', $today)
                    ->first();
                // 終了済みなら再開する
                if ($session && $session->ended_at !== null) {
                    $session->update(['ended_at' => null]);
                }
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
        $resolved = $this->resolveStoreId();
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }
        $storeId = $resolved;

        $session = BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->first();

        if (!$session) {
            return response()->json([
                'message' => '営業中のセッションがありません',
            ], 409);
        }

        // 未処理の visit があれば終了を拒否
        $activeVisitCount = Visit::where('business_session_id', $session->id)
            ->whereNull('checked_out_at')
            ->whereIn('status', ['serving', 'checkout', 'seated'])
            ->count();

        if ($activeVisitCount > 0) {
            return response()->json([
                'error' => 'HAS_ACTIVE_VISITS',
                'message' => '提供中または会計中の伝票が残っているため、営業終了できません。先に会計まで進めてください。',
            ], 409);
        }

        $endedAt = now();

        DB::transaction(function () use ($session, $endedAt) {
            // Close business session
            $session->update(['ended_at' => $endedAt]);

            // Auto checkout: close all active visits in this session
            Visit::query()
                ->where('business_session_id', $session->id)
                ->whereNull('checked_out_at')
                ->update([
                    'checked_out_at' => $endedAt,
                ]);
        });

        return response()->json([
            'message' => '営業を終了しました',
            'session' => $this->formatSession($session->fresh()),
        ]);
    }

    /**
     * Return "today's business date" in server truth.
     * - If an open session exists, use its business_date
     * - Otherwise compute by services.business_day.start in services.business_day.timezone
     */
    public function businessDay(): JsonResponse
    {
        $resolved = $this->resolveStoreId();
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }
        $storeId = $resolved;

        $tz = config('services.business_day.timezone', 'Asia/Tokyo');

        $open = BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->first();

        if ($open && $open->business_date) {
            return response()->json([
                'business_date' => $open->business_date->toDateString(),
            ]);
        }

        return response()->json([
            'business_date' => now($tz)->toDateString(),
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
            'is_open' => $session->ended_at === null,
        ];
    }

    /**
     * Resolve store id safely.
     * - Prefer DEFAULT_STORE_ID if it exists
     * - Fallback to the first store
     * - If no stores exist, return 422 (instead of 500 FK violation)
     */
    private function resolveStoreId(): int|JsonResponse
    {
        $defaultStoreId = (int) config('services.store.default_store_id', 1);
        if (Store::whereKey($defaultStoreId)->exists()) {
            return $defaultStoreId;
        }

        $firstStoreId = Store::query()->orderBy('id')->value('id');
        if ($firstStoreId) {
            return (int) $firstStoreId;
        }

        return response()->json([
            'error' => 'STORE_NOT_FOUND',
            'message' => '店舗が存在しません。先に stores を作成してください。',
        ], 422);
    }
}
