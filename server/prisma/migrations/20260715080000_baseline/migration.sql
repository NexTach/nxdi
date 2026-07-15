-- Baseline for the nine tables that existed before Prisma Migrate was introduced.
-- Existing databases must mark this migration as applied with `prisma migrate resolve`.

CREATE TABLE `tb_disclosure_trades` (
  `id` VARCHAR(191) NOT NULL,
  `disclosureId` VARCHAR(191) NOT NULL,
  `side` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `alias` VARCHAR(80) NULL,
  `marketCountry` VARCHAR(191) NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `quantity` DOUBLE NOT NULL,
  `orderPrice` DOUBLE NOT NULL,
  `exchangeRate` DOUBLE NULL,
  `profitRate` DOUBLE NOT NULL,
  `feeKrw` INTEGER NOT NULL DEFAULT 0,
  `taxKrw` INTEGER NOT NULL DEFAULT 0,
  `orderedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `DisclosureTrade_disclosureId_idx` (`disclosureId` ASC),
  INDEX `DisclosureTrade_symbol_idx` (`symbol` ASC),
  PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_disclosures` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `body` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Disclosure_createdAt_idx` (`createdAt` ASC),
  PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_dividend_records` (
  `symbol` VARCHAR(191) NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `annualDividendPerShare` DOUBLE NOT NULL,
  `trailingYield` DOUBLE NULL,
  `expectedPaymentMonths` VARCHAR(80) NOT NULL,
  `lastDividendPerShare` DOUBLE NULL,
  `memo` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`symbol` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_investment_intents` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `userName` VARCHAR(191) NOT NULL,
  `userEmail` VARCHAR(191) NOT NULL,
  `amountKrw` INTEGER NOT NULL,
  `depositorName` VARCHAR(191) NOT NULL,
  `contact` VARCHAR(191) NOT NULL,
  `guardianConfirmed` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `dividendPolicyAgreed` BOOLEAN NOT NULL DEFAULT false,
  INDEX `InvestmentIntent_status_idx` (`status` ASC),
  INDEX `InvestmentIntent_userId_idx` (`userId` ASC),
  PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_monthly_dividend_records` (
  `dividend_month` VARCHAR(7) NOT NULL,
  `actual_dividend_krw` INTEGER NOT NULL,
  `memo` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `reference_market_value_krw` DOUBLE NULL,
  INDEX `idx_monthly_dividend_records_updated_at` (`updated_at` ASC),
  PRIMARY KEY (`dividend_month` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_portfolio_daily_snapshots` (
  `snapshotDate` VARCHAR(10) NOT NULL,
  `totalMarketValueKrw` DOUBLE NOT NULL,
  `exchangeRate` DOUBLE NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `annualDividendKrw` DOUBLE NULL,
  `costBasisKrw` DOUBLE NULL,
  `closeAnnualDividendKrw` DOUBLE NULL,
  `closeCostBasisKrw` DOUBLE NULL,
  `closeExchangeRate` DOUBLE NULL,
  `closeTotalMarketValueKrw` DOUBLE NULL,
  `closedAt` DATETIME(3) NULL,
  INDEX `PortfolioDailySnapshot_snapshotDate_closedAt_idx` (`snapshotDate` ASC, `closedAt` ASC),
  INDEX `PortfolioDailySnapshot_updatedAt_idx` (`updatedAt` ASC),
  PRIMARY KEY (`snapshotDate` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_portfolio_holdings` (
  `symbol` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `alias` VARCHAR(80) NULL,
  `marketCountry` VARCHAR(191) NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `quantity` DOUBLE NOT NULL,
  `lastPrice` DOUBLE NOT NULL,
  `averagePurchasePrice` DOUBLE NULL,
  `profitLossRate` DOUBLE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `purchaseExchangeRate` DOUBLE NULL,
  `risk_level` ENUM('LOW', 'HIGH') NULL,
  PRIMARY KEY (`symbol` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_roadmap_events` (
  `id` VARCHAR(191) NOT NULL,
  `disclosure_id` VARCHAR(191) NOT NULL,
  `event_date` VARCHAR(10) NOT NULL,
  `kind` VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  `category` VARCHAR(24) NOT NULL DEFAULT 'OTHER',
  `label` VARCHAR(160) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `idx_roadmap_events_disclosure_id` (`disclosure_id` ASC),
  INDEX `idx_roadmap_events_event_date` (`event_date` ASC),
  UNIQUE INDEX `uq_roadmap_events_disclosure_date` (`disclosure_id` ASC, `event_date` ASC),
  PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_withdrawal_intents` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `userName` VARCHAR(191) NOT NULL,
  `userEmail` VARCHAR(191) NOT NULL,
  `amountKrw` INTEGER NOT NULL,
  `bankName` VARCHAR(191) NOT NULL,
  `accountNumber` VARCHAR(191) NOT NULL,
  `accountHolder` VARCHAR(191) NOT NULL,
  `contact` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `WithdrawalIntent_status_idx` (`status` ASC),
  INDEX `WithdrawalIntent_userId_idx` (`userId` ASC),
  PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tb_disclosure_trades`
  ADD CONSTRAINT `DisclosureTrade_disclosureId_fkey` FOREIGN KEY (`disclosureId`) REFERENCES `tb_disclosures` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tb_roadmap_events`
  ADD CONSTRAINT `roadmap_events_disclosure_id_fkey` FOREIGN KEY (`disclosure_id`) REFERENCES `tb_disclosures` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
