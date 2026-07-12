import { LockKeyhole, Megaphone } from "lucide-react";
import { AdminHoldingForm } from "./AdminHoldingForm";
import { DisclosureForm } from "./DisclosureForm";
import { DividendAllocationCalculator } from "./DividendAllocationCalculator";
import { MonthlyDividendRecordForm } from "./MonthlyDividendRecordForm";
import { AuthNavActions, DataGsmLoginButton } from "@/app/components/auth-actions";
import { PaginatedPanelTable } from "@/app/components/client-pagination";
import { RoadmapEditor } from "@/app/components/roadmap-editor";
import { ToastStack } from "@/app/components/toast";
import {
  AppShell,
  Badge,
  ButtonLink,
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
import { isAdminUser } from "@/lib/admin";
import { readDisclosures } from "@/lib/disclosures";
import { readDividendRecords, readMonthlyDividendRecords } from "@/lib/dividends";
import { FLASH_COOKIE_NAME, getFlashMessages } from "@/lib/flash";
import { formatCurrency, formatDateTime, formatKrw, formatNumber, statusLabel } from "@/lib/format";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { kstDateKey, readRoadmapEvents, roadmapHorizonEndDate } from "@/lib/roadmap";
import { getUserSession } from "@/lib/session";
import { readStore } from "@/lib/store";
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
  if (status === "REJECTED") return "rejected";
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
  return (
    <form className="split-actions" action="/api/admin/status" method="post">
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
    </form>
  );
}

function AdminGate({ user }: { user: AppUser | null }) {
  const signedIn = Boolean(user);

  return (
    <AppShell>
      <Navigation
        title="관리자 로그인"
        description="의향서 상태 관리"
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
  const user = await getUserSession();
  if (!isAdminUser(user)) return <AdminGate user={user} />;
  const flashMessages = await getFlashMessages();
  const roadmapToday = kstDateKey();
  const roadmapHorizon = roadmapHorizonEndDate(roadmapToday);

  const [store, portfolio, dividendRecords, monthlyDividendRecords, disclosures, roadmapEvents] = await Promise.all([
    readStore(),
    getManualPortfolioOverview(),
    readDividendRecords(),
    readMonthlyDividendRecords(),
    readDisclosures(),
    readRoadmapEvents({ through: roadmapHorizon })
  ]);
  const acceptedInvestmentIntents = store.investmentIntents.filter((intent) => intent.status === "ACCEPTED");
  const acceptedInvestment = acceptedInvestmentIntents.reduce((sum, intent) => sum + intent.amountKrw, 0);
  const pendingInvestment = store.investmentIntents
    .filter((intent) => intent.status === "PENDING")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
  const pendingWithdrawal = store.withdrawalIntents
    .filter((intent) => intent.status === "PENDING")
    .reduce((sum, intent) => sum + intent.amountKrw, 0);
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
        title="TDIV 관리자"
        description="투자/출금 의향서 확인 및 상태 변경"
        actions={<AuthNavActions user={user} />}
      />

      <Top
        title="의향서와 포트폴리오를 관리해요"
        description="운영 데이터가 사용자 화면의 예상 배당 계산과 제출 내역 상태에 바로 반영됩니다."
        backLink={{ href: "/" }}
        actions={(
          <ButtonLink href="/disclosures#roadmap" variant="secondary">
            공개 로드맵 보기
          </ButtonLink>
        )}
      />

      <Grid columns={4} className="mt-16">
        <Metric label="수락된 투자 의향" value={formatKrw(acceptedInvestment)} />
        <Metric label="대기 중 투자 의향" value={formatKrw(pendingInvestment)} />
        <Metric label="대기 중 출금 의향" value={formatKrw(pendingWithdrawal)} />
        <Metric label="포트폴리오 평가금액" value={formatKrw(portfolio.totalMarketValueKrw)} />
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
                  <form action="/api/admin/disclosures/delete" method="post">
                    <input type="hidden" name="id" value={disclosure.id} />
                    <button className="ghost" type="submit">
                      삭제
                    </button>
                  </form>
                </div>
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
          colSpan={6}
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
                  <form action="/api/admin/dividends/sync" method="post">
                    <input type="hidden" name="symbol" value={holding.symbol} />
                    <button className="secondary" type="submit">
                      외부 동기화
                    </button>
                  </form>
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
                  <form action="/api/admin/dividends/delete" method="post">
                    <input type="hidden" name="symbol" value={record.symbol} />
                    <button className="ghost" type="submit">
                      삭제
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </PaginatedPanelTable>
      ) : null}

      <SectionHeader
        id="admin-monthly-dividends"
        title="실 배당 기록"
        description="월별 실제 입금 배당금을 관리합니다."
      />

      <PaginatedPanelTable
          className="monthly-dividend-table"
          colSpan={6}
          emptyText="등록된 실 배당 기록이 없습니다."
          footerRows={
            <tr>
              <td colSpan={6}>
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
              <th>삭제</th>
            </tr>
          }
          label="실 배당 기록 페이지"
          panelHeader={<h2>실 배당 기록 입력</h2>}
          pageSize={ADMIN_MONTHLY_DIVIDEND_PAGE_SIZE}
        >
          {monthlyDividendRecords.map((record) => {
            const marketValueKrw = record.referenceMarketValueKrw;
            const dividendYield =
              typeof marketValueKrw === "number" && marketValueKrw > 0
                ? record.actualDividendKrw / marketValueKrw
                : undefined;

            return (
              <tr key={record.dividendMonth}>
                <td>{formatDividendMonth(record.dividendMonth)}</td>
                <td>{formatKrw(record.actualDividendKrw)}</td>
                <td>{typeof marketValueKrw === "number" ? formatKrw(marketValueKrw) : "-"}</td>
                <td>{formatPercent(dividendYield)}</td>
                <td>{record.memo ?? "-"}</td>
                <td>
                  <form action="/api/admin/dividends/monthly/delete" method="post">
                    <input type="hidden" name="dividendMonth" value={record.dividendMonth} />
                    <button className="ghost" type="submit">
                      삭제
                    </button>
                  </form>
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
          colSpan={9}
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
            </tr>
          }
          label="투자 의향서 페이지"
          panelHeader={<h2>투자 의향서</h2>}
          pageSize={ADMIN_INTENTS_PAGE_SIZE}
        >
          {store.investmentIntents.map((intent) => (
            <tr key={intent.id}>
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
              <td>{formatDateTime(intent.createdAt)}</td>
              <td>
                <StatusForm type="INVESTMENT" id={intent.id} current={intent.status} />
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
          colSpan={8}
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
            </tr>
          }
          label="출금 의향서 페이지"
          panelHeader={<h2>출금 의향서</h2>}
          pageSize={ADMIN_INTENTS_PAGE_SIZE}
        >
          {store.withdrawalIntents.map((intent) => (
            <tr key={intent.id}>
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
              <td>{formatDateTime(intent.createdAt)}</td>
              <td>
                <StatusForm type="WITHDRAWAL" id={intent.id} current={intent.status} />
              </td>
            </tr>
          ))}
        </PaginatedPanelTable>

      <SectionHeader
        title="배당 배분 계산기"
        description="월 전체 실 배당금에서 투자자 배분 대상 금액을 산정한 뒤, 수락 투자 원금 비율로 지급액을 계산합니다."
      />

      <Panel>
        <h2>실 배당금 지급 계산</h2>
        <DividendAllocationCalculator
          intents={acceptedInvestmentIntents.map((intent) => ({
            id: intent.id,
            userName: intent.userName,
            userEmail: intent.userEmail,
            amountKrw: intent.amountKrw,
            createdAt: intent.createdAt
          }))}
          investorPrincipalKrw={acceptedInvestment}
          totalMarketValueKrw={portfolio.totalMarketValueKrw}
        />
      </Panel>
    </AppShell>
  );
}
