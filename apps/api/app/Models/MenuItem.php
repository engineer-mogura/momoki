<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MenuItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'menu_category_id',
        'name',
        'description',
        'price',
        'image_url',
        'sort_order',
        'is_available',
        'is_active',
    ];

    protected $casts = [
        'price' => 'integer',
        'is_available' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * Get the category this item belongs to
     */
    public function menuCategory(): BelongsTo
    {
        return $this->belongsTo(MenuCategory::class);
    }

    /**
     * Get all order items for this menu item
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Check if item is orderable
     */
    public function isOrderable(): bool
    {
        return $this->is_active && $this->is_available;
    }
}
