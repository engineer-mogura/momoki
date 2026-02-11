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
     * Get user's order history.
     * 営業中セッションがあれば「現在の visit（未会計）」に紐づく注文を集約して返す。
     * 営業中セッションが無い場合はフォールバックとして最新の visit に紐づく注文を集約して返す。
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $storeId = (int) config('services.store.default_store_id');

        // 営業中（open）セッションを探す
        $currentSession = BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->first();

        $visit = $user->currentVisit();

        // 営業中セッションがある場合は、そのセッションの visit 以外は表示しない
        if ($currentSession && $visit && ((int) $visit->business_session_id !== (int) $currentSession->id)) {
            $visit = null;
        }

        if (!$visit) {
            // フォールバック: 最新の注文から visit を推定（営業終了後の確認用）
            $latestOrder = $user->orders()
                ->with(['visit'])
                ->orderBy('created_at', 'desc')
                ->first();
            $visit = $latestOrder?->visit;
        }

        if (!$visit) {
            return response()->json(['bill' => null]);
        }

        $ordersQuery = Order::query()
            ->where('user_id', $user->id)
            ->where('visit_id', $visit->id)
            ->with(['orderItems', 'store', 'visit'])
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc');

        if ($currentSession) {
            $ordersQuery->where('business_session_id', $currentSession->id);
        }

        $orders = $ordersQuery->get();

        if ($orders->isEmpty()) {
            return response()->json(['bill' => null]);
        }

        $firstOrder = $orders->first();
        $lastOrder = $orders->last();

        // items を menu_item_id 単位で合算（取消は合算・合計から除外）
        $itemsByMenuItemId = [];
        $activeTotalAmount = 0;
        foreach ($orders as $order) {
            if ($order->status === Order::STATUS_CANCELLED) {
                continue;
            }

            $activeTotalAmount += (int) $order->total_amount;
            foreach ($order->orderItems as $item) {
                $menuItemId = (int) $item->menu_item_id;
                if (!array_key_exists($menuItemId, $itemsByMenuItemId)) {
                    $itemsByMenuItemId[$menuItemId] = [
                        'menu_item_id' => $menuItemId,
                        'name' => $item->menu_item_name,
                        'price' => (int) $item->price,
                        'quantity' => 0,
                        'subtotal' => 0,
                    ];
                }
                $itemsByMenuItemId[$menuItemId]['quantity'] += (int) $item->quantity;
                $itemsByMenuItemId[$menuItemId]['subtotal'] += (int) $item->subtotal;
            }
        }

        $visitCheckedOutAt = $visit->checked_out_at;
        $bill = [
            'visit_id' => $visit->id,
            'business_session_id' => $currentSession?->id ?? $firstOrder->business_session_id,
            'created_at' => $firstOrder->created_at->toIso8601String(),
            'last_ordered_at' => $lastOrder->created_at->toIso8601String(),
            'is_paid' => (bool) $visitCheckedOutAt,
            'checked_in_at' => $visit->checked_in_at?->toIso8601String(),
            'checked_out_at' => $visitCheckedOutAt?->toIso8601String(),
            'total_amount' => $activeTotalAmount,
            'items' => array_values($itemsByMenuItemId),
            'orders' => $orders->map(fn (Order $o) => $this->formatOrder($o))->values()->all(),
        ];

        return response()->json(['bill' => $bill]);
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
        $storeId = (int) config('services.store.default_store_id');

        // 営業中セッションを取得（なければ注文不可）
        $session = BusinessSession::where('store_id', $storeId)
            ->whereNull('ended_at')
            ->first();

        if (!$session) {
            return response()->json([
                'error' => 'BUSINESS_NOT_OPEN',
                'message' => '営業中ではないため注文できません',
            ], 409);
        }

        $visit = $user->currentVisit();

        // Auto check-in if no active visit
        if (!$visit) {
            $visit = Visit::create([
                'user_id' => $user->id,
                'store_id' => $storeId,
                'business_session_id' => $session->id,
                'status' => Visit::STATUS_SERVING,
                'checked_in_at' => now(),
                'table_number' => null,
            ]);
        } elseif (is_null($visit->business_session_id)) {
            $visit->update([
                'business_session_id' => $session->id,
            ]);
        }

        $order = DB::transaction(function () use ($request, $user, $visit, $session) {
            // Create order
            $order = Order::create([
                'visit_id' => $visit->id,
                'user_id' => $user->id,
                'store_id' => $visit->store_id,
                'business_session_id' => $session->id,
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
        $isPaid = (bool) ($order->visit?->checked_out_at);

        return [
            'id' => $order->id,
            'status' => $order->status,
            'total_amount' => $order->total_amount,
            'notes' => $order->notes,
            'created_at' => $order->created_at->toIso8601String(),
            'is_paid' => $isPaid,
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
