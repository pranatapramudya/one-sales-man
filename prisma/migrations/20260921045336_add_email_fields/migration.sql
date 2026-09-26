-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'CONTACTED', 'HOT_LEAD', 'CLOSED');

-- CreateEnum
CREATE TYPE "InquiryCategory" AS ENUM ('PRICING_INFO', 'FEATURE_HOWTO', 'PRINTER_SETUP', 'BUG_REPORT', 'PAYMENT_CONFIRMATION', 'COMPLEX_CUSTOM');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('RESOLVED_BY_AI', 'ESCALATED_TO_HUMAN', 'WAITING_CLIENT', 'CLOSED');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT,
    "whatsappNumber" TEXT NOT NULL,
    "email" TEXT,
    "emailSource" TEXT,
    "rating" DOUBLE PRECISION,
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastContactedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachMessage" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT,
    "senderPhone" TEXT NOT NULL,
    "category" "InquiryCategory" NOT NULL DEFAULT 'FEATURE_HOWTO',
    "status" "TicketStatus" NOT NULL DEFAULT 'RESOLVED_BY_AI',
    "userQuery" TEXT NOT NULL,
    "aiDraftAnswer" TEXT,
    "escalatedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_whatsappNumber_key" ON "Prospect"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_email_key" ON "Prospect"("email");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
