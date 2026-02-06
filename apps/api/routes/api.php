<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\MenuCategoryController;
use App\Http\Controllers\MenuItemController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\VisitController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\MenuItemController as AdminMenuItemController;
use App\Http\Controllers\Admin\MenuCategoryController as AdminMenuCategoryController;
use App\Http\Controllers\Admin\SetupController as AdminSetupController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Health check
Route::get('/health', fn() => response()->json(['status' => 'ok']));

// Authentication (LINE Login)
Route::prefix('auth')->group(function () {
    Route::post('/line/callback', [AuthController::class, 'lineCallback']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::get('/user', [AuthController::class, 'user'])->middleware('auth:sanctum');
});

// Public routes (menu browsing)
Route::get('/menu-categories', [MenuCategoryController::class, 'index']);
Route::get('/menu-categories/{menuCategory}', [MenuCategoryController::class, 'show']);
Route::get('/menu-items', [MenuItemController::class, 'index']);
Route::get('/menu-items/{menuItem}', [MenuItemController::class, 'show']);

// Protected routes (authenticated users)
Route::middleware('auth:sanctum')->group(function () {
    // Visits (check-in)
    Route::post('/visits/checkin', [VisitController::class, 'checkin']);
    Route::get('/visits/current', [VisitController::class, 'current']);
    Route::post('/visits/checkout', [VisitController::class, 'checkout']);

    // Orders
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
});

// Admin routes
Route::prefix('admin')->middleware(['auth:sanctum'])->group(function () {
    // Admin setup (invite code) - ログイン済みなら誰でもアクセス可
    Route::post('/setup', [AdminSetupController::class, 'store']);

    // 以下は is_admin=true のみ
    Route::middleware([\App\Http\Middleware\EnsureIsAdmin::class])->group(function () {
        // Order management
        Route::get('/orders', [AdminOrderController::class, 'index']);
        Route::patch('/orders/{order}/status', [AdminOrderController::class, 'updateStatus']);

        // Menu management
        Route::apiResource('/menu-categories', AdminMenuCategoryController::class);
        Route::apiResource('/menu-items', AdminMenuItemController::class);
    });
});
