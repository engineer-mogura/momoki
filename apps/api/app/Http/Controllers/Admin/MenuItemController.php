<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuItemController extends Controller
{
    /**
     * Get all menu items (including inactive)
     */
    public function index(Request $request): JsonResponse
    {
        $query = MenuItem::with('menuCategory');

        if ($request->has('category_id')) {
            $query->where('menu_category_id', $request->category_id);
        }

        $items = $query->orderBy('sort_order')->get();

        return response()->json([
            'items' => $items->map(fn($item) => [
                'id' => $item->id,
                'menu_category_id' => $item->menu_category_id,
                'name' => $item->name,
                'description' => $item->description,
                'price' => $item->price,
                'image_url' => $item->image_url,
                'sort_order' => $item->sort_order,
                'is_available' => $item->is_available,
                'is_active' => $item->is_active,
                'category' => [
                    'id' => $item->menuCategory->id,
                    'name' => $item->menuCategory->name,
                ],
            ]),
        ]);
    }

    /**
     * Create a new menu item
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'menu_category_id' => 'required|exists:menu_categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|integer|min:0',
            'image_url' => 'nullable|string|url',
            'sort_order' => 'nullable|integer',
            'is_available' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $item = MenuItem::create([
            'menu_category_id' => $request->menu_category_id,
            'name' => $request->name,
            'description' => $request->description,
            'price' => $request->price,
            'image_url' => $request->image_url,
            'sort_order' => $request->sort_order ?? 0,
            'is_available' => $request->is_available ?? true,
            'is_active' => $request->is_active ?? true,
        ]);

        return response()->json([
            'message' => 'Item created successfully',
            'item' => $item,
        ], 201);
    }

    /**
     * Get a single item
     */
    public function show(MenuItem $menuItem): JsonResponse
    {
        $menuItem->load('menuCategory');

        return response()->json([
            'item' => $menuItem,
        ]);
    }

    /**
     * Update an item
     */
    public function update(Request $request, MenuItem $menuItem): JsonResponse
    {
        $request->validate([
            'menu_category_id' => 'sometimes|exists:menu_categories,id',
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'price' => 'sometimes|integer|min:0',
            'image_url' => 'nullable|string|url',
            'sort_order' => 'nullable|integer',
            'is_available' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $menuItem->update($request->only([
            'menu_category_id', 'name', 'description', 'price',
            'image_url', 'sort_order', 'is_available', 'is_active'
        ]));

        return response()->json([
            'message' => 'Item updated successfully',
            'item' => $menuItem,
        ]);
    }

    /**
     * Delete an item
     */
    public function destroy(MenuItem $menuItem): JsonResponse
    {
        $menuItem->delete();

        return response()->json([
            'message' => 'Item deleted successfully',
        ]);
    }
}
