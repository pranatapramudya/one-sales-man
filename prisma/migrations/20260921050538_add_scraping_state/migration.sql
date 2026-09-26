-- CreateTable
CREATE TABLE "ScrapingState" (
    "id" TEXT NOT NULL,
    "currentWave" INTEGER NOT NULL DEFAULT 1,
    "currentVerticalIndex" INTEGER NOT NULL DEFAULT 0,
    "currentCityIndex" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "totalScraped" INTEGER NOT NULL DEFAULT 0,
    "totalEmailsFound" INTEGER NOT NULL DEFAULT 0,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapingState_currentWave_currentVerticalIndex_currentCityI_idx" ON "ScrapingState"("currentWave", "currentVerticalIndex", "currentCityIndex");
