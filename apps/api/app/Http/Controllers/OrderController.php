<?php

namespace App\Http\Controllers;

use App\Models\BusinessSession;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Visit;
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
     * Preview checkout availability & total (client-side CTA gating)
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity' => 'required|integer|min:1|max:99',
        ]);

        $rawItems = collect($request->items);
        $ids = $rawItems->pluck('menu_item_id')->unique()->values()->all();

        $menuItems = MenuItem::query()
            ->whereIn('id', $ids)
            ->get()
            ->keyBy('id');

        $previewItems = [];
        $total = 0;
        $hasUnavailable = false;

        foreach ($request->items as $item) {
            $menuItemId = (int) $item['menu_item_id'];
            $qty = (int) $item['quantity'];

            /** @var MenuItem $menuItem */
            $menuItem = $menuItems->get($menuItemId);
            $orderable = $menuItem?->isOrderable() ?? false;

            if (!$orderable) {
                $hasUnavailable = true;
            }

            $price = (int) $menuItem->price;
            $subtotal = $price * $qty;

            $previewItems[] = [
                'menu_item_id' => $menuItemId,
                'name' => $menuItem->name,
                'price' => $price,
                'quantity' => $qty,
                'subtotal' => $subtotal,
                'is_orderable' => $orderable,
            ];

            if ($orderable) {
                $total += $subtotal;
            }
        }

        $canCheckout = !$hasUnavailable;

        return response()->json([
            'canCheckout' => $canCheckout,
            'reason' => $canCheckout ? null : '提供停止の商品が含まれています。内容を見直してください。',
            'total_amount' => $total,
            'items' => $previewItems,
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

        // Auto check-in if no active visit
        if (!$visit) {
            $storeId = (int) config('services.store.default_store_id');
            $visit = Visit::create([
                'user_id' => $user->id,
                'store_id' => $storeId,
                'business_session_id' => $this->currentSessionId($storeId),
                'status' => Visit::STATUS_SEATED,
                'checked_in_at' => now(),
                'table_number' => null,
            ]);
        } elseif (is_null($visit->business_session_id)) {
            $visit->update([
                'business_session_id' => $this->currentSessionId((int) $visit->store_id),
            ]);
        }

        $order = DB::transaction(function () use ($request, $user, $visit) {
            // Create order
            $order = Order::create([
                'visit_id' => $visit->id,
                'user_id' => $user->id,
                'store_id' => $visit->store_id,
                'status' => Order::STATUS_NEW,
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

    private function currentSessionId(int $storeId): ?int
    {
        return BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->value('id');
    }
}
