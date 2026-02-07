<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function history(Request $request, User $user): JsonResponse
    {
        $visits = $user->visits()
            ->with(['orders.orderItems'])
            ->orderBy('checked_in_at', 'desc')
            ->limit(30)
            ->get();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'picture_url' => $user->picture_url,
            ],
            'visits' => $visits->map(fn($visit) => [
                'id' => $visit->id,
                'table_number' => $visit->table_number,
                'status' => $visit->status ?? 'seated',
                'checked_in_at' => $visit->checked_in_at?->toIso8601String(),
                'summary' => [
                    'order_count' => $visit->orders->count(),
                    'total_amount' => $visit->orders->sum('total_amount'),
                    'last_order_at' => $visit->orders->sortByDesc('created_at')->first()?->created_at?->toIso8601String(),
                ],
                'orders' => $visit->orders->sortBy('created_at')->values()->map(fn($order) => [
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
            ]),
        ]);
    }
}
