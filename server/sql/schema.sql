-- GENERATED FILE — do not edit by hand.
-- Source of truth: server/src/db/schema.ts  (regenerate: npm run db:schema -w server)
-- Applied automatically on the first request; safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS "addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL,
	"line1" text NOT NULL,
	"area" text,
	"city" text DEFAULT 'Abbottabad' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"landmark" text,
	"instructions" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "user_id" text;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "label" text DEFAULT 'Home' NOT NULL;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "line1" text;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "area" text;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "city" text DEFAULT 'Abbottabad' NOT NULL;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "lat" double precision;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "lng" double precision;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "landmark" text;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "instructions" text;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "api_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);

ALTER TABLE "api_rate_limits" ADD COLUMN IF NOT EXISTS "key" text PRIMARY KEY NOT NULL;

ALTER TABLE "api_rate_limits" ADD COLUMN IF NOT EXISTS "hits" integer;

ALTER TABLE "api_rate_limits" ADD COLUMN IF NOT EXISTS "reset_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_id" text;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_role" text;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "action" text;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entity" text;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entity_id" text;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "meta" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"channel" text DEFAULT 'IN_APP' NOT NULL,
	"audience" text DEFAULT 'CUSTOMERS' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"recipients" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "title" text;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "body" text;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'IN_APP' NOT NULL;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "audience" text DEFAULT 'CUSTOMERS' NOT NULL;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'DRAFT' NOT NULL;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp with time zone;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "recipients" integer DEFAULT 0 NOT NULL;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "created_by" text;

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "delivery_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"radius_km" double precision NOT NULL,
	"fee" double precision NOT NULL,
	"free_above" double precision,
	"eta_minutes" integer DEFAULT 30 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "shop_id" text;

ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "name" text;

ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "radius_km" double precision;

ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "fee" double precision;

ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "free_above" double precision;

ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "eta_minutes" integer DEFAULT 30 NOT NULL;

ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"shop_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "user_id" text;

ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "shop_id" text;

ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "order_id" text;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender_id" text;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender_role" text;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "body" text;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" text;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" text;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "body" text;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'info' NOT NULL;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "data" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "is_read" boolean DEFAULT false NOT NULL;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"actor_id" text,
	"actor_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "order_id" text;

ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "status" text;

ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "note" text;

ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "actor_id" text;

ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "actor_role" text;

ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text,
	"name" text NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"unit_price" double precision NOT NULL,
	"quantity" integer NOT NULL,
	"total" double precision NOT NULL,
	"note" text,
	"emoji" text,
	"image_url" text
);

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "order_id" text;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_id" text;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "name" text;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit" text DEFAULT 'piece' NOT NULL;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit_price" double precision;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "quantity" integer;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "total" double precision;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "note" text;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "emoji" text;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "image_url" text;

CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"group_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"shop_id" text NOT NULL,
	"runner_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"payment_method" text DEFAULT 'COD' NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"payment_ref" text,
	"subtotal" double precision NOT NULL,
	"delivery_fee" double precision DEFAULT 0 NOT NULL,
	"service_fee" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"tip" double precision DEFAULT 0 NOT NULL,
	"total" double precision NOT NULL,
	"distance_km" double precision DEFAULT 0 NOT NULL,
	"eta_minutes" integer DEFAULT 30 NOT NULL,
	"promo_code" text,
	"notes" text,
	"delivery_address" jsonb NOT NULL,
	"status_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_for" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancel_reason" text,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"points_redeemed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "group_id" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shop_id" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "runner_id" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'PENDING' NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" text DEFAULT 'COD' NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'UNPAID' NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_ref" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotal" double precision;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_fee" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "service_fee" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tip" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total" double precision;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "distance_km" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "eta_minutes" integer DEFAULT 30 NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "promo_code" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "notes" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_address" jsonb;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status_history" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp with time zone;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp with time zone;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ready_at" timestamp with time zone;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "picked_up_at" timestamp with time zone;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelled_by" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancel_reason" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "points_earned" integer DEFAULT 0 NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "points_redeemed" integer DEFAULT 0 NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"provider" text NOT NULL,
	"amount" double precision NOT NULL,
	"status" text DEFAULT 'UNPAID' NOT NULL,
	"provider_ref" text,
	"failure_reason" text,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "order_id" text;

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "provider" text;

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "amount" double precision;

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'UNPAID' NOT NULL;

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "provider_ref" text;

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "failure_reason" text;

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "raw" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "payout_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"shop_id" text,
	"amount" double precision NOT NULL,
	"method" text DEFAULT 'JAZZCASH' NOT NULL,
	"account_title" text NOT NULL,
	"account_number" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "user_id" text;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "role" text;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "shop_id" text;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "amount" double precision;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "method" text DEFAULT 'JAZZCASH' NOT NULL;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "account_title" text;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "account_number" text;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'PENDING' NOT NULL;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "note" text;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "decided_by" text;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "decided_at" timestamp with time zone;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'General' NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"price" double precision NOT NULL,
	"compare_at_price" double precision,
	"image_url" text,
	"emoji" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shop_id" text;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "name" text;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" text;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'General' NOT NULL;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unit" text DEFAULT 'piece' NOT NULL;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price" double precision;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "compare_at_price" double precision;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" text;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "emoji" text;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock" integer DEFAULT 0 NOT NULL;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_available" boolean DEFAULT true NOT NULL;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "promos" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"shop_id" text,
	"title" text,
	"type" text NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL,
	"min_order" double precision DEFAULT 0 NOT NULL,
	"max_discount" double precision,
	"expires_at" timestamp with time zone,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "code" text;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "shop_id" text;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "title" text;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "type" text;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "value" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "min_order" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "max_discount" double precision;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "usage_limit" integer;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "used_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "user_id" text;

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "endpoint" text;

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "p256dh" text;

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "auth" text;

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "realtime_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"room" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "realtime_events" ADD COLUMN IF NOT EXISTS "id" bigserial PRIMARY KEY NOT NULL;

ALTER TABLE "realtime_events" ADD COLUMN IF NOT EXISTS "room" text;

ALTER TABLE "realtime_events" ADD COLUMN IF NOT EXISTS "event" text;

ALTER TABLE "realtime_events" ADD COLUMN IF NOT EXISTS "payload" jsonb;

ALTER TABLE "realtime_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "user_id" text;

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "token_hash" text;

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "user_agent" text;

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"shop_id" text NOT NULL,
	"runner_id" text,
	"customer_id" text NOT NULL,
	"shop_rating" integer NOT NULL,
	"runner_rating" integer,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "order_id" text;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "shop_id" text;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "runner_id" text;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "customer_id" text;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "shop_rating" integer;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "runner_rating" integer;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "comment" text;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "runner_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"vehicle_type" text DEFAULT 'bike' NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"heading" double precision,
	"last_seen_at" timestamp with time zone,
	"rating_avg" double precision DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"total_deliveries" integer DEFAULT 0 NOT NULL,
	"cash_in_hand" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "user_id" text PRIMARY KEY NOT NULL;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "vehicle_type" text DEFAULT 'bike' NOT NULL;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "is_available" boolean DEFAULT false NOT NULL;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "lat" double precision;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "lng" double precision;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "heading" double precision;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "rating_avg" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "rating_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "total_deliveries" integer DEFAULT 0 NOT NULL;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "cash_in_hand" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "runner_profiles" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "service_areas" (
	"id" text PRIMARY KEY NOT NULL,
	"city" text DEFAULT 'Abbottabad' NOT NULL,
	"name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius_km" double precision NOT NULL,
	"base_fee" double precision DEFAULT 60 NOT NULL,
	"surge_multiplier" double precision DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "city" text DEFAULT 'Abbottabad' NOT NULL;

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "name" text;

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "lat" double precision;

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "lng" double precision;

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "radius_km" double precision;

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "base_fee" double precision DEFAULT 60 NOT NULL;

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "surge_multiplier" double precision DEFAULT 1 NOT NULL;

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);

ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "key" text PRIMARY KEY NOT NULL;

ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "value" jsonb;

ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "updated_by" text;

CREATE TABLE IF NOT EXISTS "shop_runners" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"runner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "shop_runners" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "shop_runners" ADD COLUMN IF NOT EXISTS "shop_id" text;

ALTER TABLE "shop_runners" ADD COLUMN IF NOT EXISTS "runner_id" text;

ALTER TABLE "shop_runners" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "shops" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text DEFAULT 'grocery' NOT NULL,
	"description" text,
	"phone" text,
	"logo_url" text,
	"cover_url" text,
	"address_line" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"hours" jsonb NOT NULL,
	"prep_time_min" integer DEFAULT 15 NOT NULL,
	"min_order" double precision DEFAULT 0 NOT NULL,
	"rating_avg" double precision DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"delivery_mode" text DEFAULT 'PLATFORM_RIDER' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" text DEFAULT 'Abbottabad' NOT NULL,
	"commission_pct" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "owner_id" text;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "name" text;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "slug" text;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'grocery' NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "description" text;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "phone" text;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "logo_url" text;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "cover_url" text;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "address_line" text;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "lat" double precision;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "lng" double precision;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "is_open" boolean DEFAULT true NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "is_paused" boolean DEFAULT false NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "hours" jsonb;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "prep_time_min" integer DEFAULT 15 NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "min_order" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "rating_avg" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "rating_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'PENDING' NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "delivery_mode" text DEFAULT 'PLATFORM_RIDER' NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "city" text DEFAULT 'Abbottabad' NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "commission_pct" double precision;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_id" text,
	"subject" text NOT NULL,
	"category" text DEFAULT 'OTHER' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "user_id" text;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "order_id" text;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "subject" text;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'OTHER' NOT NULL;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'normal' NOT NULL;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'OPEN' NOT NULL;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "ticket_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text NOT NULL,
	"author_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "ticket_id" text;

ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "author_id" text;

ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "author_role" text;

ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "body" text;

ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "uploaded_images" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "uploaded_images" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "uploaded_images" ADD COLUMN IF NOT EXISTS "user_id" text;

ALTER TABLE "uploaded_images" ADD COLUMN IF NOT EXISTS "mime" text;

ALTER TABLE "uploaded_images" ADD COLUMN IF NOT EXISTS "data" text;

ALTER TABLE "uploaded_images" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"name" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'CUSTOMER' NOT NULL,
	"avatar_url" text,
	"google_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"wallet_points" integer DEFAULT 0 NOT NULL,
	"referral_code" text,
	"referred_by" text,
	"referral_credited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'CUSTOMER' NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "wallet_points" integer DEFAULT 0 NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_credited_at" timestamp with time zone;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

DO $$
BEGIN
  ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "favorites" ADD CONSTRAINT "favorites_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_runner_id_users_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "promos" ADD CONSTRAINT "promos_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_runner_id_users_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "runner_profiles" ADD CONSTRAINT "runner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "shop_runners" ADD CONSTRAINT "shop_runners_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "shop_runners" ADD CONSTRAINT "shop_runners_runner_id_users_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "addresses_user_idx" ON "addresses" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "api_rate_limits_reset_idx" ON "api_rate_limits" USING btree ("reset_at");

CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");

CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");

CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns" USING btree ("status");

CREATE INDEX IF NOT EXISTS "zones_shop_idx" ON "delivery_zones" USING btree ("shop_id");

CREATE UNIQUE INDEX IF NOT EXISTS "favorites_unique" ON "favorites" USING btree ("user_id","shop_id");

CREATE INDEX IF NOT EXISTS "messages_order_idx" ON "messages" USING btree ("order_id");

CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "order_events_order_idx" ON "order_events" USING btree ("order_id");

CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" USING btree ("order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "orders_number_idx" ON "orders" USING btree ("order_number");

CREATE INDEX IF NOT EXISTS "orders_customer_idx" ON "orders" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "orders_shop_idx" ON "orders" USING btree ("shop_id");

CREATE INDEX IF NOT EXISTS "orders_runner_idx" ON "orders" USING btree ("runner_id");

CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" USING btree ("status");

CREATE INDEX IF NOT EXISTS "orders_group_idx" ON "orders" USING btree ("group_id");

CREATE INDEX IF NOT EXISTS "orders_created_idx" ON "orders" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "payment_tx_order_idx" ON "payment_transactions" USING btree ("order_id");

CREATE INDEX IF NOT EXISTS "payment_tx_status_idx" ON "payment_transactions" USING btree ("status");

CREATE INDEX IF NOT EXISTS "payout_requests_user_idx" ON "payout_requests" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "payout_requests_status_idx" ON "payout_requests" USING btree ("status");

CREATE INDEX IF NOT EXISTS "products_shop_idx" ON "products" USING btree ("shop_id");

CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" USING btree ("category");

CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products" USING btree ("name");

CREATE UNIQUE INDEX IF NOT EXISTS "promos_code_idx" ON "promos" USING btree ("code");

CREATE UNIQUE INDEX IF NOT EXISTS "push_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");

CREATE INDEX IF NOT EXISTS "realtime_room_id_idx" ON "realtime_events" USING btree ("room","id");

CREATE INDEX IF NOT EXISTS "realtime_created_idx" ON "realtime_events" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_hash_idx" ON "refresh_tokens" USING btree ("token_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "reviews_order_idx" ON "reviews" USING btree ("order_id");

CREATE INDEX IF NOT EXISTS "reviews_shop_idx" ON "reviews" USING btree ("shop_id");

CREATE INDEX IF NOT EXISTS "runner_available_idx" ON "runner_profiles" USING btree ("is_available");

CREATE INDEX IF NOT EXISTS "service_areas_city_idx" ON "service_areas" USING btree ("city");

CREATE UNIQUE INDEX IF NOT EXISTS "shop_runners_unique" ON "shop_runners" USING btree ("shop_id","runner_id");

CREATE UNIQUE INDEX IF NOT EXISTS "shops_slug_idx" ON "shops" USING btree ("slug");

CREATE INDEX IF NOT EXISTS "shops_owner_idx" ON "shops" USING btree ("owner_id");

CREATE INDEX IF NOT EXISTS "shops_status_idx" ON "shops" USING btree ("status");

CREATE INDEX IF NOT EXISTS "shops_category_idx" ON "shops" USING btree ("category");

CREATE INDEX IF NOT EXISTS "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets" USING btree ("status");

CREATE INDEX IF NOT EXISTS "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id");

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");

CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_idx" ON "users" USING btree ("referral_code");

CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");

CREATE INDEX IF NOT EXISTS "users_created_idx" ON "users" USING btree ("created_at");

COMMIT;
