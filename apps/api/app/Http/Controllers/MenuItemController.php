<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuItemController extends Controller
{
    /**
     * Get all available menu items
     */
    public function index(Request $request): JsonResponse
    {
        $query = MenuItem::with('menuCategory')
            ->where('is_active', true)
            ->where('is_available', true);

        if ($request->has('category_id')) {
            $query->where('menu_category_id', $request->category_id);
        }

        $items = $query->orderBy('sort_order')->get();

        return response()->json([
            'items' => $items->map(fn($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'description' => $item->description,
                'price' => $item->price,
                'image_url' => $item->image_url,
                'category' => [
                    'id' => $item->menuCategory->id,
                    'name' => $item->menuCategory->name,
                ],
            ]),
        ]);
    }

    /**
     * Get a single menu item
     */
    public function show(MenuItem $menuItem): JsonResponse
    {
        if (!$menuItem->isOrderable()) {
            return response()->json(['error' => 'Item not found'], 404);
        }

        return response()->json([
            'item' => [
                'id' => $menuItem->id,
                'name' => $menuItem->name,
                'description' => $menuItem->description,
                'price' => $menuItem->price,
                'image_url' => $menuItem->image_url,
                'category' => [
                    'id' => $menuItem->menuCategory->id,
                    'name' => $menuItem->menuCategory->name,
                ],
            ],
        ]);
    }
}
