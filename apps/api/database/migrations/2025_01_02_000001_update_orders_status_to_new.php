<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add served_at and cancelled_at columns
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('served_at')->nullable()->after('notes');
            $table->timestamp('cancelled_at')->nullable()->after('served_at');
        });

        // Migrate existing status values
        DB::table('orders')->where('status', 'preparing')->update(['status' => 'new']);
        DB::table('orders')->where('status', 'paid')->update(['status' => 'served']);

        // Change default to 'new'
        Schema::table('orders', function (Blueprint $table) {
            $table->string('status')->default('new')->comment('new, served, cancelled')->change();
        });
    }

    public function down(): void
    {
        // Revert status values
        DB::table('orders')->where('status', 'new')->update(['status' => 'preparing']);

        Schema::table('orders', function (Blueprint $table) {
            $table->string('status')->default('preparing')->comment('preparing, served, paid, cancelled')->change();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['served_at', 'cancelled_at']);
        });
    }
};
