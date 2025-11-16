-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ORGANIZER');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'RAZORPAY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ORGANIZER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "poster_url" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "schema_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "form_response" JSONB NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "provider" "PaymentProvider" NOT NULL,
    "provider_order_id" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "payment_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "qr_payload" TEXT NOT NULL,
    "ticket_pdf_url" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "valid_until" TIMESTAMP(3),
    "scanned_at" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "forms_event_id_key" ON "forms"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_order_id_key" ON "tickets"("order_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
