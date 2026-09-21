-- Qareeb PostgreSQL schema. Run in Supabase > SQL Editor, once per project.
-- Browser access to application tables is denied. Only the Vercel API connects.
BEGIN;
CREATE TABLE IF NOT EXISTS public.qareeb_schema_migrations (version integer PRIMARY KEY);
DO $qareeb$
BEGIN
IF NOT EXISTS (SELECT 1 FROM public.qareeb_schema_migrations WHERE version = 1) THEN
CREATE TABLE "addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL,
	"line1" text NOT NULL,
	"area" text,
	"city" text DEFAULT 'Abbottabad' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"instructions" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "delivery_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"radius_km" double precision NOT NULL,
	"fee" double precision NOT NULL,
	"free_above" double precision,
	"sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"shop_id" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"actor_id" text,
	"actor_role" text,
	"created_at" text NOT NULL
);

CREATE TABLE "order_items" (
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

CREATE TABLE "orders" (
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
	"scheduled_for" text,
	"accepted_at" text,
	"ready_at" text,
	"picked_up_at" text,
	"delivered_at" text,
	"cancelled_at" text,
	"cancelled_by" text,
	"cancel_reason" text,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "products" (
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
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "promos" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"shop_id" text,
	"type" text NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL,
	"min_order" double precision DEFAULT 0 NOT NULL,
	"max_discount" double precision,
	"expires_at" text,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "realtime_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"room" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"shop_id" text NOT NULL,
	"runner_id" text,
	"customer_id" text NOT NULL,
	"shop_rating" integer NOT NULL,
	"runner_rating" integer,
	"comment" text,
	"created_at" text NOT NULL
);

CREATE TABLE "runner_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"vehicle_type" text DEFAULT 'bike' NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"last_seen_at" text,
	"rating_avg" double precision DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"total_deliveries" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);

CREATE TABLE "shop_runners" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"runner_id" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "shops" (
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
	"hours" jsonb NOT NULL,
	"prep_time_min" integer DEFAULT 15 NOT NULL,
	"min_order" double precision DEFAULT 0 NOT NULL,
	"rating_avg" double precision DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "users" (
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
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_runner_id_users_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "promos" ADD CONSTRAINT "promos_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "runner_profiles" ADD CONSTRAINT "runner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "shop_runners" ADD CONSTRAINT "shop_runners_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "shop_runners" ADD CONSTRAINT "shop_runners_runner_id_users_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");
CREATE INDEX "zones_shop_idx" ON "delivery_zones" USING btree ("shop_id");
CREATE UNIQUE INDEX "favorites_unique" ON "favorites" USING btree ("user_id","shop_id");
CREATE INDEX "messages_order_idx" ON "messages" USING btree ("order_id");
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id");
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");
CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("order_number");
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
CREATE INDEX "orders_shop_idx" ON "orders" USING btree ("shop_id");
CREATE INDEX "orders_runner_idx" ON "orders" USING btree ("runner_id");
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
CREATE INDEX "orders_group_idx" ON "orders" USING btree ("group_id");
CREATE INDEX "products_shop_idx" ON "products" USING btree ("shop_id");
CREATE UNIQUE INDEX "promos_code_idx" ON "promos" USING btree ("code");
CREATE UNIQUE INDEX "push_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
CREATE INDEX "realtime_room_id_idx" ON "realtime_events" USING btree ("room","id");
CREATE INDEX "realtime_created_idx" ON "realtime_events" USING btree ("created_at");
CREATE UNIQUE INDEX "reviews_order_idx" ON "reviews" USING btree ("order_id");
CREATE INDEX "reviews_shop_idx" ON "reviews" USING btree ("shop_id");
CREATE UNIQUE INDEX "shop_runners_unique" ON "shop_runners" USING btree ("shop_id","runner_id");
CREATE UNIQUE INDEX "shops_slug_idx" ON "shops" USING btree ("slug");
CREATE INDEX "shops_owner_idx" ON "shops" USING btree ("owner_id");
CREATE INDEX "shops_status_idx" ON "shops" USING btree ("status");
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
INSERT INTO public.qareeb_schema_migrations VALUES (1);
END IF;
END $qareeb$;
ALTER TABLE public."addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."delivery_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."favorites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."order_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."promos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."realtime_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."runner_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shop_runners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."qareeb_schema_migrations" ENABLE ROW LEVEL SECURITY;
DO $permissions$
BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
  REVOKE ALL ON public."addresses" FROM anon, authenticated;
  REVOKE ALL ON public."delivery_zones" FROM anon, authenticated;
  REVOKE ALL ON public."favorites" FROM anon, authenticated;
  REVOKE ALL ON public."messages" FROM anon, authenticated;
  REVOKE ALL ON public."notifications" FROM anon, authenticated;
  REVOKE ALL ON public."order_events" FROM anon, authenticated;
  REVOKE ALL ON public."order_items" FROM anon, authenticated;
  REVOKE ALL ON public."orders" FROM anon, authenticated;
  REVOKE ALL ON public."products" FROM anon, authenticated;
  REVOKE ALL ON public."promos" FROM anon, authenticated;
  REVOKE ALL ON public."push_subscriptions" FROM anon, authenticated;
  REVOKE ALL ON public."realtime_events" FROM anon, authenticated;
  REVOKE ALL ON public."reviews" FROM anon, authenticated;
  REVOKE ALL ON public."runner_profiles" FROM anon, authenticated;
  REVOKE ALL ON public."settings" FROM anon, authenticated;
  REVOKE ALL ON public."shop_runners" FROM anon, authenticated;
  REVOKE ALL ON public."shops" FROM anon, authenticated;
  REVOKE ALL ON public."users" FROM anon, authenticated;
  REVOKE ALL ON public."qareeb_schema_migrations" FROM anon, authenticated;
END IF;
END $permissions$;
COMMIT;

-- Images stored in Postgres so Vercel does not need a separate storage service.
CREATE TABLE IF NOT EXISTS public.uploaded_images (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  mime text NOT NULL,
  bytes text NOT NULL,
  created_at text NOT NULL
);
ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;
DO $permissions$
BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
  REVOKE ALL ON public.uploaded_images FROM anon, authenticated;
END IF;
END $permissions$;

-- Shared login throttling across Vercel instances (not an in-memory counter).
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  reset_at timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS api_rate_limits_reset_idx ON public.api_rate_limits(reset_at);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
DO $permissions$
BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
  REVOKE ALL ON public.api_rate_limits FROM anon, authenticated;
END IF;
END $permissions$;
