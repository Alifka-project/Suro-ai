-- Dashboard statuses are now New, Quotation sent, Invoice sent, Goal, Cancel.
-- "Invoice sent" is a new value. Nothing below writes it, so adding it in the
-- same transaction is allowed.
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'INVOICED' AFTER 'PROPOSAL';

-- Prospect (CONTACTED) and Follow-up (QUALIFIED) are no longer offered on the
-- dashboard: clients in them become New. The values stay in the enum for the
-- switched-off CRM.
UPDATE "Lead" SET "status" = 'NEW' WHERE "status" IN ('CONTACTED', 'QUALIFIED');
UPDATE "Lead" SET "stageBeforeLost" = 'NEW' WHERE "stageBeforeLost" IN ('CONTACTED', 'QUALIFIED');

-- "Remove" on the client list hides a client without deleting it.
ALTER TABLE "Lead" ADD COLUMN "removedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amountFils" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vendor" TEXT,
    "notes" TEXT,
    "leadId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_removedAt_createdAt_idx" ON "Lead"("removedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_leadId_idx" ON "Expense"("leadId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
