-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RutaSubmissionStatus" AS ENUM ('PENDING', 'FLAGGED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RutaPickStatus" AS ENUM ('SELECTED', 'SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "RutaPlayer" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),

    CONSTRAINT "RutaPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaXLink" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "xUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "accountCreatedAt" TIMESTAMP(3),
    "followersCount" INTEGER,
    "mock" BOOLEAN NOT NULL DEFAULT false,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RutaXLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaSubmission" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "xUserId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "textNorm" TEXT NOT NULL,
    "postCreatedAt" TIMESTAMP(3) NOT NULL,
    "status" "RutaSubmissionStatus" NOT NULL,
    "reasons" TEXT[],
    "flags" TEXT[],
    "metricsAtSubmit" JSONB,
    "metricsAtRecheck" JSONB,
    "recheckAt" TIMESTAMP(3),
    "rechecks" INTEGER NOT NULL DEFAULT 0,
    "week" INTEGER NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RutaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaReviewLog" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RutaReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaEntry" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "sources" TEXT[],
    "reasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RutaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaPointsLedger" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RutaPointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaEligibleImport" (
    "walletAddress" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RutaEligibleImport_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateTable
CREATE TABLE "RutaFollower" (
    "xUserId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RutaFollower_pkey" PRIMARY KEY ("xUserId")
);

-- CreateTable
CREATE TABLE "RutaSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RutaSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RutaXSpend" (
    "month" TEXT NOT NULL,
    "spentMicros" BIGINT NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RutaXSpend_pkey" PRIMARY KEY ("month")
);

-- CreateTable
CREATE TABLE "RutaCollectorPick" (
    "id" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "submissionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "status" "RutaPickStatus" NOT NULL DEFAULT 'SELECTED',
    "selectedBy" TEXT NOT NULL,
    "txHash" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RutaCollectorPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaPickCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RutaPickCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "RutaPlayer_walletAddress_key" ON "RutaPlayer"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "RutaXLink_playerId_key" ON "RutaXLink"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RutaXLink_xUserId_key" ON "RutaXLink"("xUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RutaSubmission_postId_key" ON "RutaSubmission"("postId");

-- CreateIndex
CREATE INDEX "RutaSubmission_status_recheckAt_idx" ON "RutaSubmission"("status", "recheckAt");

-- CreateIndex
CREATE INDEX "RutaSubmission_playerId_createdAt_idx" ON "RutaSubmission"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "RutaSubmission_week_status_idx" ON "RutaSubmission"("week", "status");

-- CreateIndex
CREATE INDEX "RutaReviewLog_submissionId_idx" ON "RutaReviewLog"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RutaEntry_playerId_key" ON "RutaEntry"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RutaEntry_walletAddress_key" ON "RutaEntry"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "RutaPointsLedger_refId_key" ON "RutaPointsLedger"("refId");

-- CreateIndex
CREATE INDEX "RutaPointsLedger_playerId_idx" ON "RutaPointsLedger"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RutaCollectorPick_submissionId_key" ON "RutaCollectorPick"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RutaCollectorPick_txHash_key" ON "RutaCollectorPick"("txHash");

-- CreateIndex
CREATE INDEX "RutaCollectorPick_week_status_idx" ON "RutaCollectorPick"("week", "status");

-- AddForeignKey
ALTER TABLE "RutaXLink" ADD CONSTRAINT "RutaXLink_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RutaPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaSubmission" ADD CONSTRAINT "RutaSubmission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RutaPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaReviewLog" ADD CONSTRAINT "RutaReviewLog_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "RutaSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaEntry" ADD CONSTRAINT "RutaEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RutaPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaPointsLedger" ADD CONSTRAINT "RutaPointsLedger_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RutaPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaCollectorPick" ADD CONSTRAINT "RutaCollectorPick_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "RutaSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaCollectorPick" ADD CONSTRAINT "RutaCollectorPick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RutaPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

