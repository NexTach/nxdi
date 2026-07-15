ALTER TABLE `tb_disclosure_trades`
  DROP FOREIGN KEY `DisclosureTrade_disclosureId_fkey`;

ALTER TABLE `tb_roadmap_events`
  DROP FOREIGN KEY `roadmap_events_disclosure_id_fkey`;

ALTER TABLE `tb_investment_intents`
  ADD COLUMN `product_document_version` VARCHAR(32) NULL,
  ADD COLUMN `product_document_hash` CHAR(64) NULL,
  ADD COLUMN `dividend_policy_version` VARCHAR(32) NULL,
  ADD COLUMN `dividend_policy_hash` CHAR(64) NULL,
  ADD COLUMN `agreed_at` DATETIME(3) NULL;

ALTER TABLE `tb_withdrawal_intents`
  MODIFY COLUMN `accountNumber` VARCHAR(255) NOT NULL,
  ADD COLUMN `product_document_version` VARCHAR(32) NULL,
  ADD COLUMN `product_document_hash` CHAR(64) NULL,
  ADD COLUMN `agreed_at` DATETIME(3) NULL;

CREATE TABLE `tb_investor_compliance_profiles` (
  `user_id` VARCHAR(191) NOT NULL,
  `user_name` VARCHAR(191) NOT NULL,
  `user_email` VARCHAR(191) NOT NULL,
  `real_name_verified_at` DATETIME(3) NULL,
  `bank_account_verified_at` DATETIME(3) NULL,
  `suitability_completed_at` DATETIME(3) NULL,
  `aml_cleared_at` DATETIME(3) NULL,
  `sanctions_checked_at` DATETIME(3) NULL,
  `guardian_verified_at` DATETIME(3) NULL,
  `risk_grade` VARCHAR(20) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `note` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `idx_compliance_profiles_expiry` (`expires_at`),
  PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_investor_capital_sources` (
  `id` VARCHAR(191) NOT NULL,
  `reference_key` VARCHAR(191) NOT NULL,
  `source_type` VARCHAR(32) NOT NULL,
  `source_intent_id` VARCHAR(191) NULL,
  `contract_reference` VARCHAR(120) NULL,
  `contract_version` VARCHAR(32) NULL,
  `deposit_reference` VARCHAR(120) NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `user_name` VARCHAR(191) NOT NULL,
  `user_email` VARCHAR(191) NOT NULL,
  `contracted_amount_krw` INTEGER NULL,
  `amount_krw` INTEGER NOT NULL,
  `contracted_at` DATETIME(3) NULL,
  `received_at` DATETIME(3) NOT NULL,
  `available_at` DATETIME(3) NOT NULL,
  `note` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tb_investor_capital_sources_reference_key_key` (`reference_key`),
  UNIQUE INDEX `tb_investor_capital_sources_source_intent_id_key` (`source_intent_id`),
  UNIQUE INDEX `tb_investor_capital_sources_contract_reference_key` (`contract_reference`),
  UNIQUE INDEX `tb_investor_capital_sources_deposit_reference_key` (`deposit_reference`),
  INDEX `idx_capital_sources_user_available` (`user_id`, `available_at`),
  INDEX `idx_capital_sources_type_available` (`source_type`, `available_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_portfolio_trade_executions` (
  `id` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `side` VARCHAR(8) NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `quantity` DOUBLE NOT NULL,
  `order_price` DOUBLE NOT NULL,
  `exchange_rate` DOUBLE NULL,
  `gross_amount_krw` INTEGER NOT NULL,
  `fee_krw` INTEGER NOT NULL DEFAULT 0,
  `tax_krw` INTEGER NOT NULL DEFAULT 0,
  `cash_amount_krw` INTEGER NOT NULL,
  `investor_deployed_krw` INTEGER NOT NULL DEFAULT 0,
  `non_investor_funded_krw` INTEGER NOT NULL DEFAULT 0,
  `executed_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_trade_executions_symbol_time` (`symbol`, `executed_at`),
  INDEX `idx_trade_executions_time` (`executed_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_capital_deployments` (
  `id` VARCHAR(191) NOT NULL,
  `source_id` VARCHAR(191) NOT NULL,
  `trade_execution_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `amount_krw` INTEGER NOT NULL,
  `deployed_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_deployments_user_time` (`user_id`, `deployed_at`),
  INDEX `idx_deployments_trade` (`trade_execution_id`),
  UNIQUE INDEX `uq_deployment_source_trade` (`source_id`, `trade_execution_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_capital_source_returns` (
  `id` VARCHAR(191) NOT NULL,
  `source_id` VARCHAR(191) NOT NULL,
  `amount_krw` INTEGER NOT NULL,
  `returned_at` DATETIME(3) NOT NULL,
  `reason` VARCHAR(160) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_capital_returns_source_time` (`source_id`, `returned_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_portfolio_cash_entries` (
  `id` VARCHAR(191) NOT NULL,
  `reference_key` VARCHAR(191) NOT NULL,
  `entry_type` VARCHAR(40) NOT NULL,
  `amount_krw` INTEGER NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `memo` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `tb_portfolio_cash_entries_reference_key_key` (`reference_key`),
  INDEX `idx_cash_entries_time` (`occurred_at`),
  INDEX `idx_cash_entries_type_time` (`entry_type`, `occurred_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_underlying_distribution_receipts` (
  `id` VARCHAR(191) NOT NULL,
  `reference_key` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `gross_amount_native` DOUBLE NOT NULL,
  `exchange_rate` DOUBLE NULL,
  `gross_amount_krw` INTEGER NOT NULL,
  `foreign_tax_krw` INTEGER NOT NULL DEFAULT 0,
  `brokerage_fee_krw` INTEGER NOT NULL DEFAULT 0,
  `fx_cost_krw` INTEGER NOT NULL DEFAULT 0,
  `net_amount_krw` INTEGER NOT NULL,
  `received_at` DATETIME(3) NOT NULL,
  `statement_reference` VARCHAR(120) NOT NULL,
  `note` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `tb_underlying_distribution_receipts_reference_key_key` (`reference_key`),
  INDEX `idx_distribution_receipts_time` (`received_at`),
  INDEX `idx_distribution_receipts_symbol_time` (`symbol`, `received_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_underlying_distribution_receipt_reversals` (
  `id` VARCHAR(191) NOT NULL,
  `receipt_id` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `reversed_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `tb_underlying_distribution_receipt_reversals_receipt_id_key` (`receipt_id`),
  INDEX `idx_distribution_receipt_reversals_time` (`reversed_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_investor_withdrawal_settlements` (
  `id` VARCHAR(191) NOT NULL,
  `withdrawal_intent_id` VARCHAR(191) NULL,
  `instruction_reference` VARCHAR(120) NOT NULL,
  `instruction_signed_at` DATETIME(3) NOT NULL,
  `payout_reference` VARCHAR(120) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `user_name` VARCHAR(191) NOT NULL,
  `user_email` VARCHAR(191) NOT NULL,
  `principal_reduction_krw` INTEGER NOT NULL,
  `investor_loss_rate` DOUBLE NOT NULL,
  `investor_loss_krw` INTEGER NOT NULL,
  `payable_krw` INTEGER NOT NULL,
  `fee_krw` INTEGER NOT NULL DEFAULT 0,
  `tax_krw` INTEGER NOT NULL DEFAULT 0,
  `paid_krw` INTEGER NOT NULL,
  `settled_at` DATETIME(3) NOT NULL,
  `note` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `tb_investor_withdrawal_settlements_withdrawal_intent_id_key` (`withdrawal_intent_id`),
  UNIQUE INDEX `tb_investor_withdrawal_settlements_instruction_reference_key` (`instruction_reference`),
  UNIQUE INDEX `tb_investor_withdrawal_settlements_payout_reference_key` (`payout_reference`),
  INDEX `idx_withdrawal_settlements_user_time` (`user_id`, `settled_at`),
  INDEX `idx_withdrawal_settlements_time` (`settled_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_monthly_distribution_settlements` (
  `dividend_month` VARCHAR(7) NOT NULL,
  `actual_dividend_krw` INTEGER NOT NULL,
  `portfolio_net_assets_krw` INTEGER NOT NULL,
  `investor_principal_krw` INTEGER NOT NULL,
  `company_principal_krw` INTEGER NOT NULL,
  `investor_base_dividend_krw` INTEGER NOT NULL,
  `company_transferred_krw` INTEGER NOT NULL,
  `management_fee_krw` INTEGER NOT NULL,
  `cash_distribution_krw` INTEGER NOT NULL,
  `reinvestment_credit_krw` INTEGER NOT NULL,
  `company_retained_krw` INTEGER NOT NULL,
  `rounding_carry_krw` INTEGER NOT NULL DEFAULT 0,
  `withholding_rate` DOUBLE NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'CALCULATED',
  `calculated_at` DATETIME(3) NOT NULL,
  `finalized_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `idx_distribution_settlements_time` (`calculated_at`),
  PRIMARY KEY (`dividend_month`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tb_investor_distribution_allocations` (
  `id` VARCHAR(191) NOT NULL,
  `dividend_month` VARCHAR(7) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `user_name` VARCHAR(191) NOT NULL,
  `user_email` VARCHAR(191) NOT NULL,
  `principal_krw` INTEGER NOT NULL,
  `management_fee_krw` INTEGER NOT NULL,
  `cash_distribution_krw` INTEGER NOT NULL,
  `reinvestment_credit_krw` INTEGER NOT NULL,
  `withholding_tax_krw` INTEGER NOT NULL DEFAULT 0,
  `cash_payable_krw` INTEGER NOT NULL,
  `payout_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `payout_reference` VARCHAR(120) NULL,
  `tax_remittance_reference` VARCHAR(120) NULL,
  `paid_at` DATETIME(3) NULL,
  `last_payout_failure_at` DATETIME(3) NULL,
  `last_payout_failure_reason` VARCHAR(500) NULL,
  `capital_source_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `tb_investor_distribution_allocations_payout_reference_key` (`payout_reference`),
  UNIQUE INDEX `tb_investor_distribution_allocations_tax_remittance_referenc_key` (`tax_remittance_reference`),
  UNIQUE INDEX `tb_investor_distribution_allocations_capital_source_id_key` (`capital_source_id`),
  INDEX `idx_distribution_allocations_user_month` (`user_id`, `dividend_month`),
  UNIQUE INDEX `uq_distribution_allocations_month_user` (`dividend_month`, `user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tb_capital_deployments`
  ADD CONSTRAINT `tb_capital_deployments_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `tb_investor_capital_sources` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `tb_capital_deployments_trade_execution_id_fkey` FOREIGN KEY (`trade_execution_id`) REFERENCES `tb_portfolio_trade_executions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tb_capital_source_returns`
  ADD CONSTRAINT `tb_capital_source_returns_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `tb_investor_capital_sources` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tb_underlying_distribution_receipt_reversals`
  ADD CONSTRAINT `tb_underlying_distribution_receipt_reversals_receipt_id_fkey` FOREIGN KEY (`receipt_id`) REFERENCES `tb_underlying_distribution_receipts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tb_investor_distribution_allocations`
  ADD CONSTRAINT `tb_investor_distribution_allocations_dividend_month_fkey` FOREIGN KEY (`dividend_month`) REFERENCES `tb_monthly_distribution_settlements` (`dividend_month`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `tb_investor_distribution_allocations_capital_source_id_fkey` FOREIGN KEY (`capital_source_id`) REFERENCES `tb_investor_capital_sources` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `tb_roadmap_events`
  ADD CONSTRAINT `tb_roadmap_events_disclosure_id_fkey` FOREIGN KEY (`disclosure_id`) REFERENCES `tb_disclosures` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tb_disclosure_trades`
  ADD CONSTRAINT `tb_disclosure_trades_disclosureId_fkey` FOREIGN KEY (`disclosureId`) REFERENCES `tb_disclosures` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tb_disclosure_trades`
  RENAME INDEX `DisclosureTrade_disclosureId_idx` TO `tb_disclosure_trades_disclosureId_idx`,
  RENAME INDEX `DisclosureTrade_symbol_idx` TO `tb_disclosure_trades_symbol_idx`;

ALTER TABLE `tb_disclosures`
  RENAME INDEX `Disclosure_createdAt_idx` TO `tb_disclosures_createdAt_idx`;

ALTER TABLE `tb_investment_intents`
  RENAME INDEX `InvestmentIntent_status_idx` TO `tb_investment_intents_status_idx`,
  RENAME INDEX `InvestmentIntent_userId_idx` TO `tb_investment_intents_userId_idx`;

ALTER TABLE `tb_portfolio_daily_snapshots`
  RENAME INDEX `PortfolioDailySnapshot_snapshotDate_closedAt_idx` TO `tb_portfolio_daily_snapshots_snapshotDate_closedAt_idx`,
  RENAME INDEX `PortfolioDailySnapshot_updatedAt_idx` TO `tb_portfolio_daily_snapshots_updatedAt_idx`;

ALTER TABLE `tb_withdrawal_intents`
  RENAME INDEX `WithdrawalIntent_status_idx` TO `tb_withdrawal_intents_status_idx`,
  RENAME INDEX `WithdrawalIntent_userId_idx` TO `tb_withdrawal_intents_userId_idx`;
