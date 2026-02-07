<?php

namespace App\Http\Controllers;

use App\Models\BusinessSession;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VisitController extends Controller
{
    /**
     * Check in to a store
     */
    public function checkin(Request $request): JsonResponse
    {
        $request->validate([
            'store_id' => 'required|exists:stores,id',
            'table_number' => 'nullable|string|max:50',
        ]);

        $user = $request->user();

        // Check if user already has an active visit
        $existingVisit = $user->currentVisit();
        if ($existingVisit) {
            return response()->json([
                'error' => 'Already checked in',
                'visit' => $this->formatVisit($existingVisit),
            ], 400);
        }

        $visit = Visit::create([
            'user_id' => $user->id,
            'store_id' => $request->store_id,
            'business_session_id' => $this->currentSessionId((int) $request->store_id),
            'table_number' => $request->table_number,
            'status' => Visit::STATUS_SEATED,
            'checked_in_at' => now(),
        ]);

        $visit->load('store');

        return response()->json([
            'message' => 'Checked in successfully',
            'visit' => $this->formatVisit($visit),
        ], 201);
    }

    /**
     * Get current active visit
     */
    public function current(Request $request): JsonResponse
    {
        $visit = $request->user()->currentVisit();

        if (!$visit) {
            return response()->json(['visit' => null]);
        }

        $visit->load(['store', 'orders.orderItems']);

        return response()->json([
            'visit' => $this->formatVisit($visit),
        ]);
    }

    /**
     * Check out from current visit
     */
    public function checkout(Request $request): JsonResponse
    {
        $visit = $request->user()->currentVisit();

        if (!$visit) {
            return response()->json(['error' => 'No active visit'], 400);
        }

        $visit->update(['checked_out_at' => now()]);
        $visit->load(['store', 'orders.orderItems']);

        return response()->json([
            'message' => 'Checked out successfully',
            'visit' => $this->formatVisit($visit),
        ]);
    }

    /**
     * Update table number for an active visit
     */
    public function updateTableNumber(Request $request, Visit $visit): JsonResponse
    {
        $request->validate([
            'table_number' => 'required|string|max:20',
        ]);

        // Must be the owner's active visit
        if ($visit->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        if (!$visit->isActive()) {
            return response()->json(['error' => 'Visit is no longer active'], 400);
        }

        $visit->update(['table_number' => trim($request->table_number)]);

        return response()->json([
            'visit' => [
                'id' => $visit->id,
                'table_number' => $visit->table_number,
                'checked_in_at' => $visit->checked_in_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * Format visit for response
     */
    private function formatVisit(Visit $visit): array
    {
        return [
            'id' => $visit->id,
            'store' => [
                'id' => $visit->store->id,
                'name' => $visit->store->name,
            ],
            'table_number' => $visit->table_number,
            'checked_in_at' => $visit->checked_in_at->toIso8601String(),
            'checked_out_at' => $visit->checked_out_at?->toIso8601String(),
            'total_amount' => $visit->getTotalAmount(),
            'orders_count' => $visit->orders->count(),
        ];
    }

    private function currentSessionId(int $storeId): ?int
    {
        return BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->value('id');
    }
}
