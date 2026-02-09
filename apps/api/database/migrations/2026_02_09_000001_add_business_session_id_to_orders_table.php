<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('business_session_id')
                ->nullable()
                ->after('store_id')
                ->constrained('business_sessions')
                ->nullOnDelete();
            $table->index('business_session_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['business_session_id']);
            $table->dropIndex(['business_session_id']);
            $table->dropColumn('business_session_id');
        });
    }
};
