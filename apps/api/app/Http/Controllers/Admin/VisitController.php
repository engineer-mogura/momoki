<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BusinessSession;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class VisitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $storeId = (int) config('services.store.default_store_id', 1);
        $tz = config('services.business_day.timezone', 'Asia/Tokyo');
        $businessStart = config('services.business_day.start', '21:00');
        $date = $request->input('date', now($tz)->toDateString());
        $openSession = BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->first();
        $session = null;

        // Allow "history by business date" even while an open session exists.
        // - If requested date matches open session business_date => show open session
        // - Otherwise resolve session by business_date (ended session) and show it
        if ($openSession) {
            $openDate = $openSession->business_date?->toDateString();
            if ($openDate === $date) {
                $session = $openSession;
            } else {
                $session = BusinessSession::where('store_id', $storeId)
                    ->whereDate('business_date', $date)
                    ->orderByDesc('started_at')
                    ->first();
            }
        } else {
            $session = BusinessSession::where('store_id', $storeId)
                ->whereDate('business_date', $date)
                ->orderByDesc('started_at')
                ->first();
        }

        $query = Visit::with(['user', 'orders.orderItems']);

        if ($session) {
            $query->where('business_session_id', $session->id);
        } else {
            // Business-day range: e.g. 2026-02-07 21:00:00 ~ 2026-02-08 20:59:59 (JST)
            $dayStart = Carbon::parse("{$date} {$businessStart}", $tz);
            $dayEnd = $dayStart->copy()->addDay()->subSecond();

            $query->where(function ($q) use ($dayStart, $dayEnd) {
                // Match by checked_in_at in JST range
                $q->whereBetween('checked_in_at', [$dayStart, $dayEnd])
                    // OR has orders created on that day (fallback for older data)
                    ->orWhereHas('orders', function ($oq) use ($dayStart, $dayEnd) {
                        $oq->whereBetween('created_at', [$dayStart, $dayEnd]);
                    });
            });
        }

        $visits = $query
            ->orderBy('checked_in_at', 'desc')
            ->get();

        $response = [
            'visits' => $visits->map(fn(Visit $visit) => $this->formatVisit($visit)),
            'session' => $session ? $this->formatSession($session) : null,
        ];

        if (!$session) {
            $response['date'] = $date;
        }

        return response()->json($response);
    }

    public function updateStatus(Request $request, Visit $visit): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:' . implode(',', Visit::STATUSES),
        ]);

        $visit->update(['status' => $request->status]);
        $visit->load(['user', 'orders.orderItems']);

        return response()->json([
            'ok' => true,
            'visit' => $this->formatVisit($visit),
        ]);
    }

    private function formatVisit(Visit $visit): array
    {
        $orders = $visit->orders->sortBy('created_at')->values();
        $activeOrders = $orders->where('status', '!=', 'cancelled');
        $newCount = $orders->where('status', 'new')->count();

        return [
            'id' => $visit->id,
            'table_number' => $visit->table_number,
            'checked_in_at' => $visit->checked_in_at?->toIso8601String(),
            'status' => $visit->status ?? 'seated',
            'user' => [
                'id' => $visit->user->id,
                'display_name' => $visit->user->display_name,
                'picture_url' => $visit->user->picture_url,
            ],
            'orders' => $orders->map(fn($order) => [
                'id' => $order->id,
                'status' => $order->status,
                'total_amount' => $order->total_amount,
                'created_at' => $order->created_at->toIso8601String(),
                'items' => $order->orderItems->map(fn($item) => [
                    'id' => $item->id,
                    'name' => $item->menu_item_name,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->price,
                ]),
            ]),
            'summary' => [
                'order_count' => $activeOrders->count(),
                'total_amount' => $activeOrders->sum('total_amount'),
                'last_order_at' => $activeOrders->last()?->created_at?->toIso8601String(),
                'new_count' => $newCount,
                'has_new' => $newCount > 0,
            ],
        ];
    }

    private function formatSession(BusinessSession $session): array
    {
        return [
            'id' => $session->id,
            'business_date' => $session->business_date?->toDateString(),
            'started_at' => $session->started_at?->toIso8601String(),
            'ended_at' => $session->ended_at?->toIso8601String(),
        ];
    }
}
