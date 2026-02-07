FROM php:8.3-cli

# system deps + postgres driver
RUN apt-get update && apt-get install -y \
    git unzip libpq-dev \
  && docker-php-ext-install pdo pdo_pgsql \
  && rm -rf /var/lib/apt/lists/*

# composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# install deps
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress

# copy app
COPY . .

# permissions (runtime)
RUN mkdir -p bootstrap/cache storage/framework/cache storage/framework/sessions storage/framework/views storage/logs \
  && chmod -R 777 bootstrap/cache storage

EXPOSE 8080
CMD php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
