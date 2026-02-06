<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    /**
     * Get user's order history
     */
    public function index(Request $request): JsonResponse
    {
        $orders = $request->user()
            ->orders()
            ->with(['orderItems', 'store'])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json([
            'orders' => $orders->map(fn($order) => $this->formatOrder($order)),
            'pagination' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
            ],
        ]);
    }

    /**
     * Create a new order
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity' => 'required|integer|min:1|max:99',
            'notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $visit = $user->currentVisit();

        if (!$visit) {
            return response()->json([
                'error' => 'You must check in before ordering',
            ], 400);
        }

        $order = DB::transaction(function () use ($request, $user, $visit) {
            // Create order
            $order = Order::create([
                'visit_id' => $visit->id,
                'user_id' => $user->id,
                'store_id' => $visit->store_id,
                'status' => Order::STATUS_PREPARING,
                'notes' => $request->notes,
            ]);

            // Add order items
            foreach ($request->items as $item) {
                $menuItem = MenuItem::findOrFail($item['menu_item_id']);

                if (!$menuItem->isOrderable()) {
                    throw new \Exception("Item '{$menuItem->name}' is not available");
                }

                OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $menuItem->id,
                    'menu_item_name' => $menuItem->name,
                    'price' => $menuItem->price,
                    'quantity' => $item['quantity'],
                ]);
            }

            // Calculate total
            $order->calculateTotal();

            return $order;
        });

        $order->load(['orderItems', 'store']);

        return response()->json([
            'message' => 'Order placed successfully',
            'order' => $this->formatOrder($order),
        ], 201);
    }

    /**
     * Get a single order
     */
    public function show(Request $request, Order $order): JsonResponse
    {
        // Ensure user owns this order
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        $order->load(['orderItems', 'store']);

        return response()->json([
            'order' => $this->formatOrder($order),
        ]);
    }

    /**
     * Format order for response
     */
    private function formatOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'status' => $order->status,
            'total_amount' => $order->total_amount,
            'notes' => $order->notes,
            'created_at' => $order->created_at->toIso8601String(),
            'store' => [
                'id' => $order->store->id,
                'name' => $order->store->name,
            ],
            'items' => $order->orderItems->map(fn($item) => [
                'id' => $item->id,
                'name' => $item->menu_item_name,
                'price' => $item->price,
                'quantity' => $item->quantity,
                'subtotal' => $item->subtotal,
            ]),
        ];
    }
}
