FROM php:8.3-cli

RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends ca-certificates curl git unzip libpq-dev; \
  docker-php-ext-install pdo pdo_pgsql; \
  rm -rf /var/lib/apt/lists/*



COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# ★ ここ重要：すでに Laravel ルートが build context
WORKDIR /app

# 先に全部コピー（artisan を含める）
COPY . .

# ここで artisan が存在する状態になる
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress

RUN mkdir -p bootstrap/cache storage/framework/cache storage/framework/sessions storage/framework/views storage/logs \
  && chmod -R 777 bootstrap/cache storage

EXPOSE 8080
CMD php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
