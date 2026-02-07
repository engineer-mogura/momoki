<?php

namespace App\Http\Controllers;

use App\Models\MenuCategory;
use Illuminate\Http\JsonResponse;

class MenuCategoryController extends Controller
{
    /**
     * Get all active menu categories with their items
     */
    public function index(): JsonResponse
    {
        $categories = MenuCategory::with(['availableMenuItems'])
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'categories' => $categories->map(fn($category) => [
                'id' => $category->id,
                'name' => $category->name,
                'description' => $category->description,
                'theme' => $category->theme,
                'items' => $category->availableMenuItems->map(fn($item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'description' => $item->description,
                    'price' => $item->price,
                    'image_url' => $item->image_url,
                ]),
            ]),
        ]);
    }

    /**
     * Get a single category with its items
     */
    public function show(MenuCategory $menuCategory): JsonResponse
    {
        if (!$menuCategory->is_active) {
            return response()->json(['error' => 'Category not found'], 404);
        }

        $menuCategory->load('availableMenuItems');

        return response()->json([
            'category' => [
                'id' => $menuCategory->id,
                'name' => $menuCategory->name,
                'description' => $menuCategory->description,
                'theme' => $menuCategory->theme,
                'items' => $menuCategory->availableMenuItems->map(fn($item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'description' => $item->description,
                    'price' => $item->price,
                    'image_url' => $item->image_url,
                ]),
            ],
        ]);
    }
}
