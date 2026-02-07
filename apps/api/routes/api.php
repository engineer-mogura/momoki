<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\MenuCategoryController;
use App\Http\Controllers\MenuItemController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\VisitController;
use App\Http\Controllers\Admin\BusinessSessionController as AdminBusinessSessionController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\VisitController as AdminVisitController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
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
    Route::patch('/visits/{visit}/table-number', [VisitController::class, 'updateTableNumber']);

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
        // Business session management
        Route::get('/business-sessions/current', [AdminBusinessSessionController::class, 'current']);
        Route::post('/business-sessions/start', [AdminBusinessSessionController::class, 'start']);
        Route::post('/business-sessions/end', [AdminBusinessSessionController::class, 'end']);

        // Visit board (伝票ボード)
        Route::get('/visits', [AdminVisitController::class, 'index']);
        Route::patch('/visits/{visit}/status', [AdminVisitController::class, 'updateStatus']);

        // User history (将来用)
        Route::get('/users/{user}/history', [AdminUserController::class, 'history']);

        // Order management (legacy, kept for compatibility)
        Route::get('/orders', [AdminOrderController::class, 'index']);
        Route::patch('/orders/{order}/status', [AdminOrderController::class, 'updateStatus']);
        Route::patch('/orders/{order}/serve', [AdminOrderController::class, 'serve']);
        Route::patch('/orders/{order}/cancel', [AdminOrderController::class, 'cancel']);

        // Menu management
        Route::apiResource('/menu-categories', AdminMenuCategoryController::class);
        Route::apiResource('/menu-items', AdminMenuItemController::class);
    });
});
