<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Visit extends Model
{
    use HasFactory;

    /**
     * @deprecated 管理UIからは着席を廃止。新規作成で使用しないこと。
     */
    public const STATUS_SEATED = 'seated';
    public const STATUS_SERVING = 'serving';
    public const STATUS_CHECKOUT = 'checkout';
    public const STATUS_DONE = 'done';

    public const STATUSES = [
        self::STATUS_SERVING,
        self::STATUS_CHECKOUT,
        self::STATUS_DONE,
    ];

    protected $fillable = [
        'user_id',
        'store_id',
        'business_session_id',
        'table_number',
        'status',
        'checked_in_at',
        'checked_out_at',
    ];

    protected $casts = [
        'checked_in_at' => 'datetime',
        'checked_out_at' => 'datetime',
    ];

    /**
     * Get the user for this visit
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the store for this visit
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * Get the business session for this visit
     */
    public function businessSession(): BelongsTo
    {
        return $this->belongsTo(BusinessSession::class);
    }

    /**
     * Get all orders for this visit
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * Check if visit is still active
     */
    public function isActive(): bool
    {
        return is_null($this->checked_out_at);
    }

    /**
     * Calculate total amount for this visit
     */
    public function getTotalAmount(): int
    {
        return $this->orders->sum('total_amount');
    }
}
