<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MenuCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuCategoryController extends Controller
{
    /**
     * Get all menu categories (including inactive)
     */
    public function index(Request $request): JsonResponse
    {
        $query = MenuCategory::with('menuItems');

        if ($request->has('store_id')) {
            $query->where('store_id', $request->store_id);
        }

        $categories = $query->orderBy('sort_order')->get();

        return response()->json([
            'categories' => $categories->map(fn($category) => [
                'id' => $category->id,
                'store_id' => $category->store_id,
                'name' => $category->name,
                'description' => $category->description,
                'sort_order' => $category->sort_order,
                'is_active' => $category->is_active,
                'items_count' => $category->menuItems->count(),
            ]),
        ]);
    }

    /**
     * Create a new menu category
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'store_id' => 'required|exists:stores,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $category = MenuCategory::create([
            'store_id' => $request->store_id,
            'name' => $request->name,
            'description' => $request->description,
            'sort_order' => $request->sort_order ?? 0,
            'is_active' => $request->is_active ?? true,
        ]);

        return response()->json([
            'message' => 'Category created successfully',
            'category' => $category,
        ], 201);
    }

    /**
     * Get a single category
     */
    public function show(MenuCategory $menuCategory): JsonResponse
    {
        $menuCategory->load('menuItems');

        return response()->json([
            'category' => $menuCategory,
        ]);
    }

    /**
     * Update a category
     */
    public function update(Request $request, MenuCategory $menuCategory): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $menuCategory->update($request->only([
            'name', 'description', 'sort_order', 'is_active'
        ]));

        return response()->json([
            'message' => 'Category updated successfully',
            'category' => $menuCategory,
        ]);
    }

    /**
     * Delete a category
     */
    public function destroy(MenuCategory $menuCategory): JsonResponse
    {
        $menuCategory->delete();

        return response()->json([
            'message' => 'Category deleted successfully',
        ]);
    }
}
