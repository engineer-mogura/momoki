<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1) Normalize existing data
        DB::table('visits')
            ->where('status', 'seated')
            ->update(['status' => 'serving']);

        // 2) Change default to serving (Postgres-safe)
        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE visits ALTER COLUMN status SET DEFAULT 'serving'");

            // 3) (Optional) CHECK constraint to fix allowed values
            // NOTE: We intentionally exclude 'seated' because admin UI removed it.
            DB::statement('ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check');
            DB::statement("ALTER TABLE visits ADD CONSTRAINT visits_status_check CHECK (status IN ('serving','checkout','done'))");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check');
            DB::statement("ALTER TABLE visits ALTER COLUMN status SET DEFAULT 'seated'");

            // Restore previous "looser" allowed values (keeps existing data intact).
            DB::statement("ALTER TABLE visits ADD CONSTRAINT visits_status_check CHECK (status IN ('seated','serving','checkout','done'))");
        }
    }
};

