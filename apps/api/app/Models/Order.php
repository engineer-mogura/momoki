<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    public const STATUS_NEW = 'new';
    public const STATUS_SERVED = 'served';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_NEW,
        self::STATUS_SERVED,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'visit_id',
        'user_id',
        'store_id',
        'status',
        'total_amount',
        'notes',
        'served_at',
        'cancelled_at',
    ];

    protected $casts = [
        'total_amount' => 'integer',
        'served_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    /**
     * Get the visit for this order
     */
    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    /**
     * Get the user who placed this order
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the store for this order
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * Get all items in this order
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Calculate and update total amount
     */
    public function calculateTotal(): void
    {
        $this->total_amount = $this->orderItems->sum('subtotal');
        $this->save();
    }
}
