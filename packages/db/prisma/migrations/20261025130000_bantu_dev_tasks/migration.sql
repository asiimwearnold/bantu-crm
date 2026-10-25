CREATE TYPE "BantuTaskStatus" AS ENUM ('DRAFT', 'QUEUED', 'RUNNING', 'PAUSED', 'DONE', 'FAILED');

CREATE TABLE "bantuTask" (
    "id" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "status" "BantuTaskStatus" NOT NULL DEFAULT 'DRAFT',
    "branch" TEXT,
    "report" TEXT,
    "failure" TEXT,
    "workerId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bantuTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bantuTask_status_createdAt_idx" ON "bantuTask"("status", "createdAt");
CREATE INDEX "bantuTask_leaseUntil_idx" ON "bantuTask"("leaseUntil");

ALTER TABLE "bantuTask"
ADD CONSTRAINT "bantuTask_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bantuTask"
ADD CONSTRAINT "bantuTask_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
