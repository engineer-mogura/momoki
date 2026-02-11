<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 1) 同一 (store_id, business_date) の重複を解消
     *    - started_at が最も早い行を canonical とする
     *    - visits.business_session_id / orders.business_session_id を canonical に付け替え
     *    - canonical 以外を削除
     * 2) unique(store_id, business_date) を付与
     */
    public function up(): void
    {
        // ── Step 1: 重複解消 ──
        // canonical = 各 (store_id, business_date) で started_at が最小の id
        $canonicals = DB::select("
            SELECT store_id, business_date, MIN(id) AS canonical_id
            FROM business_sessions
            GROUP BY store_id, business_date
            HAVING COUNT(*) > 1
        ");

        foreach ($canonicals as $row) {
            $canonicalId = $row->canonical_id;
            $storeId = $row->store_id;
            $businessDate = $row->business_date;

            // 重複 session の id を取得
            $duplicateIds = DB::table('business_sessions')
                ->where('store_id', $storeId)
                ->where('business_date', $businessDate)
                ->where('id', '!=', $canonicalId)
                ->pluck('id')
                ->all();

            if (empty($duplicateIds)) {
                continue;
            }

            // visits を canonical に付け替え
            DB::table('visits')
                ->whereIn('business_session_id', $duplicateIds)
                ->update(['business_session_id' => $canonicalId]);

            // orders を canonical に付け替え
            DB::table('orders')
                ->whereIn('business_session_id', $duplicateIds)
                ->update(['business_session_id' => $canonicalId]);

            // 重複 session を削除
            DB::table('business_sessions')
                ->whereIn('id', $duplicateIds)
                ->delete();
        }

        // ── Step 2: ユニーク制約付与 ──
        // 既存の非ユニークインデックスを削除してからユニークに置き換え
        Schema::table('business_sessions', function ($table) {
            $table->dropIndex(['store_id', 'business_date']);
        });

        Schema::table('business_sessions', function ($table) {
            $table->unique(['store_id', 'business_date'], 'business_sessions_store_date_unique');
        });
    }

    /**
     * down: ユニーク制約を外して通常インデックスに戻す。
     * 削除済みの重複 session は復元できない（不可逆）。
     */
    public function down(): void
    {
        Schema::table('business_sessions', function ($table) {
            $table->dropUnique('business_sessions_store_date_unique');
        });

        Schema::table('business_sessions', function ($table) {
            $table->index(['store_id', 'business_date']);
        });
    }
};
