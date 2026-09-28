-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('NOTE', 'EVENT');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TODO', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "Installment" AS ENUM ('DEPOSIT', 'MILESTONE', 'FINAL');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'CANCELLED');

-- DropIndex
DROP INDEX "Lead_status_idx";

-- DropIndex
DROP INDEX "Note_leadId_idx";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "agreementId" TEXT,
ADD COLUMN     "installment" "Installment";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "expectedCloseDate" TIMESTAMP(3),
ADD COLUMN     "lostAt" TIMESTAMP(3),
ADD COLUMN     "lostNote" TEXT,
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "probability" INTEGER,
ADD COLUMN     "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "stageBeforeLost" "LeadStatus",
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "title" TEXT,
ADD COLUMN     "wonAt" TIMESTAMP(3),
ALTER COLUMN "clientType" SET DEFAULT 'COMPANY',
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "country" DROP NOT NULL,
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "contactPreference" DROP NOT NULL,
ALTER COLUMN "timeline" DROP NOT NULL,
ALTER COLUMN "budget" DROP NOT NULL,
ALTER COLUMN "message" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "kind" "NoteKind" NOT NULL DEFAULT 'NOTE';

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ActivityType" NOT NULL DEFAULT 'FOLLOW_UP',
    "summary" TEXT NOT NULL,
    "note" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "feedback" TEXT,
    "leadId" TEXT NOT NULL,
    "assigneeId" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientCompany" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "subtotalFils" INTEGER NOT NULL,
    "vatBps" INTEGER NOT NULL,
    "totalFils" INTEGER NOT NULL,
    "depositPct" INTEGER NOT NULL DEFAULT 50,
    "midpointPct" INTEGER NOT NULL DEFAULT 25,
    "finalPct" INTEGER NOT NULL DEFAULT 25,
    "midpointMilestone" TEXT NOT NULL DEFAULT 'mid-point delivery',
    "invoiceDueDays" INTEGER NOT NULL DEFAULT 14,
    "lateFeeBps" INTEGER NOT NULL DEFAULT 200,
    "feedbackDays" INTEGER NOT NULL DEFAULT 3,
    "warrantyDays" INTEGER NOT NULL DEFAULT 30,
    "terminationNoticeDays" INTEGER NOT NULL DEFAULT 14,
    "projectName" TEXT NOT NULL,
    "background" TEXT NOT NULL DEFAULT '',
    "scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "packageRef" TEXT,
    "deliverables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outOfScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assumptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "leadId" TEXT,
    "quoteId" TEXT,
    "projectId" TEXT,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE INDEX "Activity_doneAt_dueDate_idx" ON "Activity"("doneAt", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_number_key" ON "Agreement"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_quoteId_key" ON "Agreement"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_projectId_key" ON "Agreement"("projectId");

-- CreateIndex
CREATE INDEX "Agreement_status_idx" ON "Agreement"("status");

-- CreateIndex
CREATE INDEX "Agreement_leadId_idx" ON "Agreement"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_agreementId_installment_key" ON "Invoice"("agreementId", "installment");

-- CreateIndex
CREATE INDEX "Lead_status_sortOrder_idx" ON "Lead"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");

-- CreateIndex
CREATE INDEX "Note_leadId_createdAt_idx" ON "Note"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_leadId_idx" ON "Project"("leadId");

-- CreateIndex
CREATE INDEX "Quote_leadId_idx" ON "Quote"("leadId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

