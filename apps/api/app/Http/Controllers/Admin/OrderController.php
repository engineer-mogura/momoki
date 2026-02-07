<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['orderItems.menuItem', 'user', 'visit']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $orders = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'orders' => $orders->map(fn($order) => [
                'id' => $order->id,
                'status' => $order->status,
                'total_amount' => $order->total_amount,
                'created_at' => $order->created_at->toIso8601String(),
                'user' => [
                    'id' => $order->user->id,
                    'display_name' => $order->user->display_name,
                    'picture_url' => $order->user->picture_url,
                ],
                'visit' => $order->visit ? [
                    'id' => $order->visit->id,
                    'table_number' => $order->visit->table_number,
                    'checked_in_at' => $order->visit->checked_in_at?->toIso8601String(),
                ] : null,
                'items' => $order->orderItems->map(fn($item) => [
                    'id' => $item->id,
                    'menu_item_id' => $item->menu_item_id,
                    'name' => $item->menu_item_name,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->price,
                ]),
            ]),
        ]);
    }

    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:' . implode(',', Order::STATUSES),
        ]);

        $order->update(['status' => $request->status]);

        return response()->json([
            'ok' => true,
            'order' => [
                'id' => $order->id,
                'status' => $order->status,
            ],
        ]);
    }

    public function serve(Order $order): JsonResponse
    {
        if ($order->status === Order::STATUS_SERVED) {
            return response()->json([
                'ok' => true,
                'order' => [
                    'id' => $order->id,
                    'status' => $order->status,
                    'served_at' => $order->served_at?->toIso8601String(),
                ],
            ]);
        }

        $order->update([
            'status' => Order::STATUS_SERVED,
            'served_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
            'order' => [
                'id' => $order->id,
                'status' => $order->status,
                'served_at' => $order->served_at?->toIso8601String(),
            ],
        ]);
    }

    public function cancel(Order $order): JsonResponse
    {
        if ($order->status === Order::STATUS_CANCELLED) {
            return response()->json([
                'ok' => true,
                'order' => [
                    'id' => $order->id,
                    'status' => $order->status,
                ],
            ]);
        }

        // Guard: reject cancel if the visit is done (paid)
        $visit = $order->visit;
        if ($visit && in_array($visit->status, ['done', 'checkout'], true)) {
            return response()->json([
                'message' => 'This bill is completed (paid). Reopen it before cancelling orders.',
            ], 409);
        }

        $order->update([
            'status' => Order::STATUS_CANCELLED,
            'cancelled_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
            'order' => [
                'id' => $order->id,
                'status' => $order->status,
            ],
        ]);
    }
}
