import { LockKeyhole, Megaphone } from "lucide-react";
import { AdminHoldingForm } from "./AdminHoldingForm";
import { DisclosureForm } from "./DisclosureForm";
import { DividendAllocationCalculator } from "./DividendAllocationCalculator";
import { ConfirmCapitalForm } from "./ConfirmCapitalForm";
import { ApproveComplianceForm } from "./ApproveComplianceForm";
import { MonthlyDividendRecordForm } from "./MonthlyDividendRecordForm";
import { RecordDistributionReceiptForm } from "./RecordDistributionReceiptForm";
import { SettleWithdrawalForm } from "./SettleWithdrawalForm";
import { ApiMutationForm } from "@/app/components/api-mutation-form";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import { AuthNavActions, DataGsmLoginButton } from "@/app/components/auth-actions";
import { PaginatedPanelTable } from "@/app/components/client-pagination";
import { RoadmapEditor } from "@/app/components/roadmap-editor";
import { ToastStack } from "@/app/components/toast";
import {
  AppShell,
  Badge,
  CtaPanel,
  Grid,
  Metric,
  MutedText,
  Navigation,
  Panel,
  SectionHeader,
  TdsSelect,
  Top
} from "@/app/components/tds";
import { getAdminDashboard, getSession } from "@/lib/api";
import { FLASH_COOKIE_NAME, getFlashMessages } from "@/lib/flash";
import { formatCurrency, formatDateTime, formatKrw, formatNumber, statusLabel } from "@/lib/format";
import { stockPrimaryLabel, stockSecondaryLabel } from "@/lib/stock-display";
import type { AppUser, IntentStatus } from "@/lib/types";

const ADMIN_DISCLOSURES_PAGE_SIZE = 8;
const ADMIN_PORTFOLIO_PAGE_SIZE = 8;
const ADMIN_DIVIDEND_PAGE_SIZE = 8;
const ADMIN_DETACHED_DIVIDEND_PAGE_SIZE = 8;
const ADMIN_MONTHLY_DIVIDEND_PAGE_SIZE = 12;
const ADMIN_INTENTS_PAGE_SIZE = 10;

function statusClass(status: string): "accepted" | "rejected" | "pending" {
  if (status === "ACCEPTED") return "accepted";
  if (status === "REJECTED" || status === "WITHDRAWN") return "rejected";
  return "pending";
}

function formatDividendAmount(value: number, currency: "KRW" | "USD") {
  return formatCurrency(value, currency, 4);
}

function formatPercent(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${formatNumber(value * 100, 2)}%`;
}

function formatDividendMonth(value: string) {
  const [year, month] = value.split("-");
  return `${year}년 ${Number(month)}월`;
}

function StatusForm({
  type,
  id,
  current
}: {
  type: "INVESTMENT" | "WITHDRAWAL";
  id: string;
  current: IntentStatus;
}) {
  if (current === "WITHDRAWN") return <Badge tone="rejected">신청자 철회</Badge>;
  return (
    <ApiMutationForm className="split-actions" action="/api/admin/status" method="post">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <TdsSelect name="status" defaultValue={current} aria-label="상태">
        <option value="PENDING">대기</option>
        <option value="ACCEPTED">수락</option>
        <option value="REJECTED">거절</option>
      </TdsSelect>
      <button className="secondary" type="submit">
        저장
      </button>
    </ApiMutationForm>
  );
}

function AdminGate({ user }: { user: AppUser | null }) {
  const signedIn = Boolean(user);

  return (
    <AppShell>
      <Navigation
        actions={<AuthNavActions user={user} />}
      />

      <Top
        title="관리자 권한이 필요해요"
        description="DataGSM 인증 계정이 관리자 목록에 포함되어 있어야 운영 화면에 접근할 수 있습니다."
        backLink={{ href: "/" }}
      />

      <CtaPanel className="max-w-gate">
        <h2>
          <LockKeyhole size={18} /> 관리자 권한 필요
        </h2>
        <p className="lede">
          {signedIn
            ? "현재 DataGSM 계정 이메일은 관리자 환경변수에 포함되어 있지 않습니다."
            : "DataGSM으로 로그인한 뒤, 이메일이 ADMIN_EMAILS에 포함된 계정만 접근할 수 있습니다."}
        </p>
        {!signedIn ? (
          <DataGsmLoginButton />
        ) : null}
      </CtaPanel>
    </AppShell>
  );
}

export default async function AdminPage() {
  const dashboard = await getAdminDashboard();
  if (!dashboard) {
    const { user } = await getSession();
    return <AdminGate user={user} />;
  }
  const {
    user,
    store,
    portfolio,
    dividendRecords,
    monthlyDividendRecords,
    disclosures,
    roadmapEvents,
    roadmapToday,
    roadmapHorizon,
    dividendAllocationIntents,
    dividendAllocationWithdrawals,
    capitalLedger,
    policy
  } = dashboard;
  const flashMessages = await getFlashMessages();
  const acceptedInvestmentIntents = store.investmentIntents.filter((intent) => intent.status === "ACCEPTED");
  const acceptedInvestment = acceptedInvestmentIntents.reduce((sum, intent) => sum + intent.amountKrw, 0);
  const pendingInvestment = store.investmentIntents
    .filter((intent) => intent.status === "PENDING")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
  const pendingWithdrawal = store.withdrawalIntents
    .filter((intent) => intent.status === "PENDING")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
  const pendingCapitalKrw = capitalLedger.sources.reduce((sum, source) => sum + source.availableKrw, 0);
  const capitalSourceByIntent = new Map(
    capitalLedger.sources.flatMap((source) => source.sourceIntentId ? [[source.sourceIntentId, source] as const] : [])
  );
  const complianceByUser = new Map(
    capitalLedger.complianceProfiles.map((profile) => [profile.userId, profile])
  );
  const withdrawalSettlementByIntent = new Map(
    capitalLedger.withdrawals.flatMap((settlement) => settlement.withdrawalIntentId
      ? [[settlement.withdrawalIntentId, settlement] as const]
      : [])
  );
  const distributionByMonth = new Map(
    capitalLedger.distributions.map((settlement) => [settlement.dividendMonth, settlement])
  );
  const distributionAllocations = capitalLedger.distributions.flatMap((settlement) =>
    settlement.allocations.map((allocation) => ({
      ...allocation,
      dividendMonth: settlement.dividendMonth,
      settlementStatus: settlement.status
    }))
  );
  const dividendRecordsBySymbol = new Map(
    dividendRecords.map((record) => [record.symbol.toUpperCase(), record])
  );
  const portfolioSymbols = new Set(portfolio.holdings.map((holding) => holding.symbol.toUpperCase()));
  const detachedDividendRecords = dividendRecords.filter(
    (record) => !portfolioSymbols.has(record.symbol.toUpperCase())
  );
  return (
    <AppShell>
      <ToastStack messages={flashMessages} clearCookieName={FLASH_COOKIE_NAME} />

      <Navigation
        actions={<AuthNavActions user={user} />}
      />

      <Top
        title="의향서와 포트폴리오를 관리해요"
        description="운영 데이터가 사용자 화면의 예상 배당 계산과 제출 내역 상태에 바로 반영됩니다."
        backLink={{ href: "/" }}
      />

      <Grid columns={4} className="mt-16">
        <Metric label="수락된 투자 의향" value={formatKrw(acceptedInvestment)} />
        <Metric label="대기 중 투자 의향" value={formatKrw(pendingInvestment)} />
        <Metric label="대기 중 출금 의향" value={formatKrw(pendingWithdrawal)} />
        <Metric label="포트폴리오 평가금액" value={formatKrw(portfolio.totalMarketValueKrw)} />
      </Grid>

      <Grid columns={4} className="mt-12">
        <Metric label="실제 운용편입 원금" value={formatKrw(capitalLedger.totalInvestorPrincipalKrw)} />
        <Metric label="미편입·재투자 대기금" value={formatKrw(pendingCapitalKrw)} />
        <Metric label="포트폴리오 증권 평가액" value={formatKrw(portfolio.securitiesMarketValueKrw)} />
        <Metric label="포트폴리오 결제 현금" value={formatKrw(capitalLedger.cashBalanceKrw)} />
      </Grid>

      <RoadmapEditor
        disclosures={disclosures}
        events={roadmapEvents}
        today={roadmapToday}
        horizon={roadmapHorizon}
      />

      <SectionHeader
        id="admin-disclosures"
        title="공시"
        description="사용자에게 노출되는 공시와 첨부 거래 이력을 관리합니다."
      />

      <PaginatedPanelTable
          colSpan={4}
          emptyText="등록된 공시가 없습니다."
          header={
            <tr>
              <th>제목</th>
              <th>첨부 거래</th>
              <th>등록일</th>
              <th>관리</th>
            </tr>
          }
          label="관리자 공시 페이지"
          panelHeader={
            <div className="admin-panel-header">
              <h2>
                <Megaphone size={18} /> 공시 관리
              </h2>
              <DisclosureForm />
            </div>
          }
          pageSize={ADMIN_DISCLOSURES_PAGE_SIZE}
        >
          {disclosures.map((disclosure) => (
            <tr key={disclosure.id}>
              <td>
                <strong>{disclosure.title}</strong>
                <br />
                <MutedText>
                  {disclosure.body.slice(0, 80)}
                  {disclosure.body.length > 80 ? "..." : ""}
                </MutedText>
              </td>
              <td>{disclosure.trades.length}건</td>
              <td>{formatDateTime(disclosure.createdAt)}</td>
              <td>
                <div className="split-actions">
                  <DisclosureForm disclosure={disclosure} />
                  <ApiMutationForm action="/api/admin/disclosures/delete" method="post">
                    <input type="hidden" name="id" value={disclosure.id} />
                    <button className="ghost" type="submit">
                      삭제
                    </button>
                  </ApiMutationForm>
                </div>
              </td>
            </tr>
          ))}
        </PaginatedPanelTable>

      <SectionHeader
        title="투자자별 분배 지급"
        description="월 정산 확정 후 실제 은행 지급과 원천세 납부 거래식별값을 투자자별로 기록합니다."
      />

      <PaginatedPanelTable
        colSpan={9}
        emptyText="확정된 투자자별 분배 배정이 없습니다."
        header={
          <tr>
            <th>배당월</th>
            <th>투자자</th>
            <th>기준원금</th>
            <th>운용보수</th>
            <th>현금 총액</th>
            <th>원천세</th>
            <th>실지급액</th>
            <th>재투자</th>
            <th>지급 확인</th>
          </tr>
        }
        label="투자자별 분배 지급 페이지"
        panelHeader={<h2>투자자별 분배 지급 원장</h2>}
        pageSize={ADMIN_MONTHLY_DIVIDEND_PAGE_SIZE}
      >
        {distributionAllocations.map((allocation) => (
          <tr key={allocation.id}>
            <td>{formatDividendMonth(allocation.dividendMonth)}</td>
            <td><strong>{allocation.userName}</strong><br /><MutedText>{allocation.userEmail}</MutedText></td>
            <td>{formatKrw(allocation.principalKrw)}</td>
            <td>{formatKrw(allocation.managementFeeKrw)}</td>
            <td>{formatKrw(allocation.cashDistributionKrw)}</td>
            <td>{formatKrw(allocation.withholdingTaxKrw)}</td>
            <td>{formatKrw(allocation.cashPayableKrw)}</td>
            <td>{formatKrw(allocation.reinvestmentCreditKrw)}</td>
            <td>
              {allocation.payoutStatus === "PAID" ? (
                <><Badge tone="accepted">지급완료</Badge>{allocation.paidAt ? <><br /><MutedText>{formatDateTime(allocation.paidAt)}</MutedText></> : null}</>
              ) : allocation.settlementStatus !== "FINALIZED" ? "월 정산 확정 전" : (
                <>
                  {allocation.lastPayoutFailureReason ? <><Badge tone="rejected">지급실패</Badge><br /><MutedText>{allocation.lastPayoutFailureReason}</MutedText></> : null}
                  <ApiMutationForm action="/api/admin/dividends/payout/confirm" className="form compact" method="post">
                    <input name="allocationId" type="hidden" value={allocation.id} />
                    <input maxLength={120} name="payoutReference" placeholder="은행 지급 거래식별값" required />
                    <input maxLength={120} name="taxRemittanceReference" placeholder="원천세 납부 식별값/해당없음" required />
                    <button className="secondary" type="submit">지급·납부 확인</button>
                  </ApiMutationForm>
                  <ApiMutationForm action="/api/admin/dividends/payout/fail" className="form compact" method="post">
                    <input name="allocationId" type="hidden" value={allocation.id} />
                    <input maxLength={500} name="reason" placeholder="지급 실패사유" required />
                    <button className="ghost" type="submit">실패 기록</button>
                  </ApiMutationForm>
                </>
              )}
            </td>
          </tr>
        ))}
      </PaginatedPanelTable>

      <SectionHeader
        id="admin-portfolio"
        title="운영 포트폴리오"
        description="보유 종목, 수량, 현재가, USD 매입환율을 관리합니다."
      />

      <PaginatedPanelTable
          className="portfolio-table mt-16"
          colSpan={2}
          emptyText="포트폴리오 종목이 없습니다."
          footerRows={
            <tr>
              <td colSpan={2}>
                <AdminHoldingForm />
              </td>
            </tr>
          }
          header={
            <tr>
              <th>종목</th>
              <th>평가금액</th>
            </tr>
          }
          label="운영 포트폴리오 페이지"
          panelHeader={<h2>운영 포트폴리오 관리</h2>}
          pageSize={ADMIN_PORTFOLIO_PAGE_SIZE}
        >
          {portfolio.holdings.map((holding) => (
            <tr key={holding.symbol}>
              <td>
                <AdminHoldingForm {...holding} />
              </td>
              <td>{formatKrw(holding.marketValueKrw)}</td>
            </tr>
          ))}
        </PaginatedPanelTable>

      <SectionHeader
        id="admin-dividends"
        title="배당 데이터"
        description="포트폴리오 종목의 배당 데이터는 외부 데이터로 동기화합니다."
      />

      <PaginatedPanelTable
          className="dividend-table"
          colSpan={7}
          emptyText="포트폴리오 종목이 없습니다."
          header={
            <tr>
              <th>종목</th>
              <th>연 배당/주</th>
              <th>배당수익률</th>
              <th>지급월</th>
              <th>최근 배당</th>
              <th>동기화</th>
            </tr>
          }
          label="배당 데이터 페이지"
          panelHeader={<h2>배당 데이터 동기화</h2>}
          pageSize={ADMIN_DIVIDEND_PAGE_SIZE}
        >
          {portfolio.holdings.map((holding) => {
            const record = dividendRecordsBySymbol.get(holding.symbol.toUpperCase());
            const secondaryLabel = stockSecondaryLabel(holding);
            return (
              <tr key={holding.symbol}>
                <td>
                  <strong>{stockPrimaryLabel(holding)}</strong>
                  <br />
                  {secondaryLabel ? <MutedText>{secondaryLabel}</MutedText> : null}
                </td>
                <td>{record ? formatDividendAmount(record.annualDividendPerShare, record.currency) : "-"}</td>
                <td>{record?.trailingYield ? `${formatNumber(record.trailingYield * 100, 2)}%` : "-"}</td>
                <td>
                  {record?.expectedPaymentMonths.map((month) => `${month}월`).join(", ") ?? "-"}
                </td>
                <td>
                  {record?.lastDividendPerShare
                    ? formatDividendAmount(record.lastDividendPerShare, record.currency)
                    : "-"}
                </td>
                <td>
                  <ApiMutationForm action="/api/admin/dividends/sync" method="post">
                    <input type="hidden" name="symbol" value={holding.symbol} />
                    <button className="secondary" type="submit">
                      외부 동기화
                    </button>
                  </ApiMutationForm>
                </td>
              </tr>
            );
          })}
        </PaginatedPanelTable>

      {detachedDividendRecords.length > 0 ? (
        <PaginatedPanelTable
            className="dividend-table compact"
            colSpan={3}
            emptyText="포트폴리오 외 배당 데이터가 없습니다."
            header={
              <tr>
                <th>종목</th>
                <th>연 배당/주</th>
                <th>삭제</th>
              </tr>
            }
            id="admin-detached-dividends"
            label="포트폴리오 외 배당 데이터 페이지"
            panelClassName="mt-12"
            panelHeader={<h2>포트폴리오 외 배당 데이터</h2>}
            pageSize={ADMIN_DETACHED_DIVIDEND_PAGE_SIZE}
          >
            {detachedDividendRecords.map((record) => (
              <tr key={record.symbol}>
                <td>{record.symbol}</td>
                <td>{formatDividendAmount(record.annualDividendPerShare, record.currency)}</td>
                <td>
                  <ApiMutationForm action="/api/admin/dividends/delete" method="post">
                    <input type="hidden" name="symbol" value={record.symbol} />
                    <button className="ghost" type="submit">
                      삭제
                    </button>
                  </ApiMutationForm>
                </td>
              </tr>
            ))}
          </PaginatedPanelTable>
      ) : null}

      <SectionHeader
        id="admin-monthly-dividends"
        title="실 배당 입금·월말 정산"
        description="종목별 실제 체결환율과 공제액을 기록하면 내부 원장 ID가 자동 생성되고, 월 순입금액은 원장에서 자동 합산됩니다."
      />

      <PaginatedPanelTable
        className="distribution-receipt-table"
        colSpan={8}
        emptyText="기록된 종목별 실분배금 입금이 없습니다."
        footerRows={<tr><td colSpan={8}><RecordDistributionReceiptForm holdings={portfolio.holdings} /></td></tr>}
        header={
          <tr>
            <th>입금시각</th>
            <th>종목</th>
            <th>내부 원장 ID</th>
            <th>총액</th>
            <th>체결환율</th>
            <th>세금</th>
            <th>외부비용</th>
            <th>원화 순입금</th>
          </tr>
        }
        label="종목별 실분배금 입금 원장 페이지"
        panelHeader={<h2>종목별 실분배금 입금 원장</h2>}
        pageSize={ADMIN_MONTHLY_DIVIDEND_PAGE_SIZE}
      >
        {capitalLedger.distributionReceipts.map((receipt) => (
          <tr key={receipt.id}>
            <td>{formatDateTime(receipt.receivedAt)}{receipt.reversedAt ? <><br /><Badge tone="rejected">반대분개</Badge></> : null}</td>
            <td><strong>{receipt.symbol}</strong><br /><MutedText>{receipt.currency}</MutedText></td>
            <td>{receipt.statementReference}</td>
            <td>{formatNumber(receipt.grossAmountNative, receipt.currency === "USD" ? 4 : 0)} {receipt.currency}</td>
            <td>{typeof receipt.exchangeRate === "number" ? formatNumber(receipt.exchangeRate, 2) : "-"}</td>
            <td>{formatKrw(receipt.foreignTaxKrw)}</td>
            <td>{formatKrw(receipt.brokerageFeeKrw + receipt.fxCostKrw)}</td>
            <td>
              <strong>{formatKrw(receipt.netAmountKrw)}</strong>
              {!receipt.reversedAt ? (
                <ApiMutationForm action="/api/admin/dividends/receipt/reverse" className="form compact" method="post">
                  <input name="receiptId" type="hidden" value={receipt.id} />
                  <input maxLength={500} name="reason" placeholder="오류 정정 사유" required />
                  <button className="ghost" type="submit">반대분개</button>
                </ApiMutationForm>
              ) : <><br /><MutedText>{receipt.reversalReason}</MutedText></>}
            </td>
          </tr>
        ))}
      </PaginatedPanelTable>

      <PaginatedPanelTable
          className="monthly-dividend-table"
          colSpan={7}
          emptyText="등록된 실 배당 기록이 없습니다."
          footerRows={
            <tr>
              <td colSpan={7}>
                <MonthlyDividendRecordForm />
              </td>
            </tr>
          }
          header={
            <tr>
              <th>배당월</th>
              <th>실 배당금</th>
              <th>기준 평가금액</th>
              <th>월 분배율</th>
              <th>메모</th>
              <th>정산상태</th>
              <th>삭제</th>
            </tr>
          }
          label="실 배당 기록 페이지"
          panelClassName="mt-16"
          panelHeader={<h2>월 원장 합계 정산</h2>}
          pageSize={ADMIN_MONTHLY_DIVIDEND_PAGE_SIZE}
        >
          {monthlyDividendRecords.map((record) => {
            const marketValueKrw = record.referenceMarketValueKrw;
            const dividendYield =
              typeof marketValueKrw === "number" && marketValueKrw > 0
                ? record.actualDividendKrw / marketValueKrw
                : undefined;
            const settlement = distributionByMonth.get(record.dividendMonth);

            return (
              <tr key={record.dividendMonth}>
                <td>{formatDividendMonth(record.dividendMonth)}</td>
                <td>{formatKrw(record.actualDividendKrw)}</td>
                <td>{typeof marketValueKrw === "number" ? formatKrw(marketValueKrw) : "-"}</td>
                <td>{formatPercent(dividendYield)}</td>
                <td>{record.memo ?? "-"}</td>
                <td>
                  {settlement?.status ?? "미계산"}
                  {settlement?.status === "CALCULATED" ? (
                    <ApiMutationForm action="/api/admin/dividends/monthly/finalize" method="post">
                      <input type="hidden" name="dividendMonth" value={record.dividendMonth} />
                      <button className="secondary" type="submit">월말 정산 확정</button>
                    </ApiMutationForm>
                  ) : null}
                </td>
                <td>
                  <ApiMutationForm action="/api/admin/dividends/monthly/delete" method="post">
                    <input type="hidden" name="dividendMonth" value={record.dividendMonth} />
                    <button className="ghost" type="submit">
                      삭제
                    </button>
                  </ApiMutationForm>
                </td>
              </tr>
            );
          })}
        </PaginatedPanelTable>

      <SectionHeader
        id="admin-investments"
        title="투자 의향서"
        description="신청자 정보와 필수 동의 여부를 보고 상태를 저장합니다."
      />

      <PaginatedPanelTable
          colSpan={11}
          emptyText="투자 의향서가 없습니다."
          header={
            <tr>
              <th>신청자</th>
              <th>금액</th>
              <th>입금자명</th>
              <th>연락처</th>
              <th>보호자</th>
              <th>배당 정책</th>
              <th>상태</th>
              <th>제출일</th>
              <th>변경</th>
              <th>계약 전 확인</th>
              <th>실계약·입금</th>
            </tr>
          }
          label="투자 의향서 페이지"
          panelHeader={<h2>투자 의향서</h2>}
          pageSize={ADMIN_INTENTS_PAGE_SIZE}
        >
          {store.investmentIntents.map((intent) => {
            const source = capitalSourceByIntent.get(intent.id);
            const compliance = complianceByUser.get(intent.userId);
            const complianceValid = Boolean(
              compliance &&
              compliance.realNameVerifiedAt &&
              compliance.bankAccountVerifiedAt &&
              compliance.suitabilityCompletedAt &&
              compliance.amlClearedAt &&
              compliance.sanctionsCheckedAt &&
              new Date(compliance.expiresAt).getTime() > Date.now()
            );
            return <tr key={intent.id}>
              <td>
                <strong>{intent.userName}</strong>
                <br />
                <MutedText>{intent.userEmail}</MutedText>
              </td>
              <td>{formatKrw(intent.amountKrw)}</td>
              <td>{intent.depositorName}</td>
              <td>{intent.contact}</td>
              <td>{intent.guardianConfirmed ? "확인 예정" : "미확인"}</td>
              <td>{intent.dividendPolicyAgreed ? "동의" : "미동의"}</td>
              <td>
                <Badge tone={statusClass(intent.status)}>{statusLabel(intent.status)}</Badge>
              </td>
              <td>{formatDateTime(intent.createdAt)}<br /><MutedText>{intent.productDocumentVersion && intent.dividendPolicyVersion ? `상품 v${intent.productDocumentVersion} · 분배 v${intent.dividendPolicyVersion}` : "기존 동의 증빙 없음"}</MutedText></td>
              <td>
                <StatusForm type="INVESTMENT" id={intent.id} current={intent.status} />
              </td>
              <td>
                {complianceValid ? (
                  <><Badge tone="accepted">유효</Badge><br /><MutedText>{compliance?.riskGrade ?? "등급 미기재"} · {formatDateTime(compliance!.expiresAt)}까지</MutedText></>
                ) : intent.status === "ACCEPTED" ? (
                  <ApproveComplianceForm userId={intent.userId} userName={intent.userName} userEmail={intent.userEmail} />
                ) : "수락 후 확인"}
              </td>
              <td>
                {source ? (
                  <>
                    <strong>{formatKrw(source.amountKrw)}</strong>
                    <br />
                    <MutedText>편입 {formatKrw(source.deployedKrw)} · 대기 {formatKrw(source.availableKrw)}</MutedText>
                  </>
                ) : intent.status === "ACCEPTED" && complianceValid ? (
                  <ConfirmCapitalForm intentId={intent.id} intentAmountKrw={intent.amountKrw} />
                ) : intent.status === "ACCEPTED" ? "사전확인 후 가능" : "수락 후 별도 확인"}
              </td>
            </tr>;
          })}
        </PaginatedPanelTable>

      <SectionHeader
        title="실제 자본 원장"
        description="계약입금과 재투자 대기금은 실제 매수 체결 전까지 원금에 포함되지 않습니다."
      />

      <PaginatedPanelTable
        colSpan={7}
        emptyText="확인된 계약입금 또는 재투자 대기금이 없습니다."
        header={
          <tr>
            <th>투자자</th>
            <th>구분</th>
            <th>총액</th>
            <th>실제 편입</th>
            <th>미편입</th>
            <th>확인시각</th>
            <th>미편입 반환</th>
          </tr>
        }
        label="실제 자본 원장 페이지"
        panelHeader={<h2>계약·입금·재투자 대기금</h2>}
        pageSize={ADMIN_INTENTS_PAGE_SIZE}
      >
        {capitalLedger.sources.map((source) => (
          <tr key={source.id}>
            <td><strong>{source.userName}</strong><br /><MutedText>{source.userEmail}</MutedText></td>
            <td>{source.sourceType === "CONTRACT_DEPOSIT" ? "계약입금" : "재투자 대기"}</td>
            <td>{formatKrw(source.amountKrw)}</td>
            <td>{formatKrw(source.deployedKrw)}</td>
            <td>{formatKrw(source.availableKrw)}</td>
            <td>{formatDateTime(source.receivedAt)}</td>
            <td>
              {source.availableKrw > 0 ? (
                <ApiMutationForm action="/api/admin/capital/return" className="form compact" method="post">
                  <input name="sourceId" type="hidden" value={source.id} />
                  <FormattedNumberInput max={source.availableKrw} min="1" name="amountKrw" required />
                  <input maxLength={160} name="reason" placeholder="반환 사유" required />
                  <button className="ghost" type="submit">반환 기록</button>
                </ApiMutationForm>
              ) : "-"}
            </td>
          </tr>
        ))}
      </PaginatedPanelTable>

      <SectionHeader
        id="admin-withdrawals"
        title="출금 의향서"
        description="계좌 정보와 연락처를 확인한 뒤 상태를 저장합니다."
      />

      <PaginatedPanelTable
          colSpan={9}
          emptyText="출금 의향서가 없습니다."
          header={
            <tr>
              <th>신청자</th>
              <th>금액</th>
              <th>계좌</th>
              <th>예금주</th>
              <th>연락처</th>
              <th>상태</th>
              <th>제출일</th>
              <th>변경</th>
              <th>실제 출금 정산</th>
            </tr>
          }
          label="출금 의향서 페이지"
          panelHeader={<h2>출금 의향서</h2>}
          pageSize={ADMIN_INTENTS_PAGE_SIZE}
        >
          {store.withdrawalIntents.map((intent) => {
            const settlement = withdrawalSettlementByIntent.get(intent.id);
            return <tr key={intent.id}>
              <td>
                <strong>{intent.userName}</strong>
                <br />
                <MutedText>{intent.userEmail}</MutedText>
              </td>
              <td>{formatKrw(intent.amountKrw)}</td>
              <td>
                {intent.bankName}
                <br />
                <MutedText>{intent.accountNumber}</MutedText>
              </td>
              <td>{intent.accountHolder}</td>
              <td>{intent.contact}</td>
              <td>
                <Badge tone={statusClass(intent.status)}>{statusLabel(intent.status)}</Badge>
              </td>
              <td>{formatDateTime(intent.createdAt)}<br /><MutedText>{intent.productDocumentVersion ? `상품 v${intent.productDocumentVersion}` : "기존 동의 증빙 없음"}</MutedText></td>
              <td>
                <StatusForm type="WITHDRAWAL" id={intent.id} current={intent.status} />
              </td>
              <td>
                {settlement ? (
                  <><strong>{formatKrw(settlement.paidKrw)}</strong><br /><MutedText>원금 차감 {formatKrw(settlement.principalReductionKrw)}</MutedText></>
                ) : intent.status === "ACCEPTED" ? (
                  <SettleWithdrawalForm intentId={intent.id} />
                ) : "수락 후 정산"}
              </td>
            </tr>;
          })}
        </PaginatedPanelTable>

      <SectionHeader
        title="의향 기반 배당 배분 참고 계산기"
        description="수락된 의향은 계약이나 원금이 아닙니다. 후속 계약 원장이 마련되기 전까지 내부 참고 시뮬레이션으로만 사용합니다."
      />

      <Panel>
        <h2>실 배당금 지급 계산</h2>
        <DividendAllocationCalculator
          defaultDividendMonth={roadmapToday.slice(0, 7)}
          companyDividendTransferRate={policy.companyDividendTransferRate}
          managementFeeRate={policy.managementFeeRate}
          intents={dividendAllocationIntents}
          withdrawals={dividendAllocationWithdrawals}
          monthlyInvestorDividendCapRate={policy.monthlyInvestorDividendCapRate}
          totalMarketValueKrw={portfolio.totalMarketValueKrw}
        />
      </Panel>
    </AppShell>
  );
}
