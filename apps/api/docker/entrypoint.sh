#!/bin/sh
set -e

cd /var/www/html

# .env の存在チェック（なければエラーで停止）
if [ ! -f .env ]; then
    echo "[entrypoint] ERROR: .env file not found!"
    echo "[entrypoint] Please copy .env.example to .env before starting:"
    echo "  cp apps/api/.env.example apps/api/.env"
    exit 1
fi

# vendor/autoload.php がなければ composer install
if [ ! -f vendor/autoload.php ]; then
    echo "[entrypoint] Installing composer dependencies..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

# APP_KEY が空なら key:generate（失敗しても続行）
if grep -q "^APP_KEY=$" .env 2>/dev/null; then
    echo "[entrypoint] Generating application key..."
    php artisan key:generate --force || true
fi

# キャッシュクリア（Windows/volume環境での破損防止）
echo "[entrypoint] Clearing caches..."
php artisan config:clear || true
php artisan cache:clear || true
php artisan route:clear || true
php artisan view:clear || true

echo "[entrypoint] Starting Laravel development server..."
exec php artisan serve --host=0.0.0.0 --port=8000
