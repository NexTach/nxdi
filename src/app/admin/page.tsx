import { LockKeyhole, Megaphone } from "lucide-react";
import { AdminHoldingForm } from "./AdminHoldingForm";
import { DisclosureForm } from "./DisclosureForm";
import { DividendAllocationCalculator } from "./DividendAllocationCalculator";
import { AuthNavActions, DataGsmLoginButton } from "@/app/components/auth-actions";
import { ToastStack, type ToastMessage } from "@/app/components/toast";
import {
  AppShell,
  Badge,
  CtaPanel,
  Grid,
  Metric,
  MutedText,
  Navigation,
  Pagination,
  Panel,
  SectionHeader,
  TableSurface,
  Top
} from "@/app/components/tds";
import { isAdminUser } from "@/lib/admin";
import { readDisclosures } from "@/lib/disclosures";
import { readDividendRecords } from "@/lib/dividends";
import { formatCurrency, formatDateTime, formatKrw, formatNumber, statusLabel } from "@/lib/format";
import { pageFromSearchParams, paginateItems } from "@/lib/pagination";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";
import { readStore } from "@/lib/store";
import { stockPrimaryLabel, stockSecondaryLabel } from "@/lib/stock-display";
import type { AppUser, IntentStatus } from "@/lib/types";

type AdminProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ADMIN_DISCLOSURES_PAGE_SIZE = 8;
const ADMIN_PORTFOLIO_PAGE_SIZE = 8;
const ADMIN_DIVIDEND_PAGE_SIZE = 8;
const ADMIN_DETACHED_DIVIDEND_PAGE_SIZE = 8;
const ADMIN_INTENTS_PAGE_SIZE = 10;

function statusClass(status: string): "accepted" | "rejected" | "pending" {
  if (status === "ACCEPTED") return "accepted";
  if (status === "REJECTED") return "rejected";
  return "pending";
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function adminToastMessages(params: Record<string, string | string[] | undefined>): ToastMessage[] {
  const messages: ToastMessage[] = [];
  const portfolio = firstParam(params.portfolio);
  const dividend = firstParam(params.dividend);
  const disclosure = firstParam(params.disclosure);
  const error = firstParam(params.error);

  if (params.updated) {
    messages.push({ id: "updated", title: "상태가 저장되었습니다", tone: "success" });
  }
  if (portfolio) {
    messages.push({
      id: `portfolio-${portfolio}`,
      title:
        portfolio === "deleted"
          ? "포트폴리오 종목이 삭제되었습니다"
          : portfolio === "traded"
            ? "거래가 포트폴리오에 반영되었습니다"
            : "포트폴리오가 저장되었습니다",
      tone: "success"
    });
  }
  if (dividend) {
    const title =
      dividend === "synced"
        ? "배당 데이터가 동기화되었습니다"
        : dividend === "deleted"
          ? "배당 데이터가 삭제되었습니다"
          : "배당 데이터가 저장되었습니다";
    messages.push({ id: `dividend-${dividend}`, title, tone: "success" });
  }
  if (disclosure) {
    const title =
      disclosure === "deleted"
        ? "공시가 삭제되었습니다"
        : disclosure === "updated"
          ? "공시가 수정되었습니다"
          : "공시가 등록되었습니다";
    messages.push({ id: `disclosure-${disclosure}`, title, tone: "success" });
  }
  if (error) {
    const errorMessages: Record<string, string> = {
      invalid_status: "상태 값을 다시 확인해주세요",
      invalid_holding: "포트폴리오 입력값을 다시 확인해주세요",
      invalid_trade: "거래 입력값을 다시 확인해주세요",
      trade_not_found: "거래를 적용할 종목을 찾을 수 없습니다",
      trade_insufficient: "매도 수량이 현재 보유 수량보다 큽니다",
      invalid_delete: "삭제할 종목을 다시 확인해주세요",
      invalid_exchange_rate: "환율 입력값을 다시 확인해주세요",
      invalid_dividend: "배당 입력값을 다시 확인해주세요",
      invalid_dividend_months: "배당 지급월을 다시 확인해주세요",
      invalid_dividend_delete: "삭제할 배당 데이터를 다시 확인해주세요",
      invalid_dividend_sync: "동기화할 종목을 다시 확인해주세요",
      dividend_sync_failed: "외부 배당 데이터를 가져오지 못했습니다",
      invalid_disclosure: "공시 입력값을 다시 확인해주세요",
      invalid_disclosure_trade: "공시 거래 이력 입력값을 다시 확인해주세요",
      invalid_disclosure_delete: "삭제할 공시를 다시 확인해주세요"
    };
    messages.push({
      id: `error-${error}`,
      title: errorMessages[error] ?? "요청을 처리하지 못했습니다",
      tone: "error"
    });
  }

  return messages;
}

function formatDividendAmount(value: number, currency: "KRW" | "USD") {
  return formatCurrency(value, currency, 4);
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
      <select name="status" defaultValue={current} aria-label="상태">
        <option value="PENDING">대기</option>
        <option value="ACCEPTED">수락</option>
        <option value="REJECTED">거절</option>
      </select>
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

export default async function AdminPage({ searchParams }: AdminProps) {
  const params = (await searchParams) ?? {};
  const user = await getUserSession();
  if (!isAdminUser(user)) return <AdminGate user={user} />;

  const [store, portfolio, dividendRecords, disclosures] = await Promise.all([
    readStore(),
    getManualPortfolioOverview(),
    readDividendRecords(),
    readDisclosures()
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
  const paginatedDisclosures = paginateItems(
    disclosures,
    pageFromSearchParams(params, "disclosurePage"),
    ADMIN_DISCLOSURES_PAGE_SIZE
  );
  const paginatedPortfolioHoldings = paginateItems(
    portfolio.holdings,
    pageFromSearchParams(params, "portfolioPage"),
    ADMIN_PORTFOLIO_PAGE_SIZE
  );
  const paginatedDividendHoldings = paginateItems(
    portfolio.holdings,
    pageFromSearchParams(params, "dividendPage"),
    ADMIN_DIVIDEND_PAGE_SIZE
  );
  const paginatedDetachedDividendRecords = paginateItems(
    detachedDividendRecords,
    pageFromSearchParams(params, "detachedDividendPage"),
    ADMIN_DETACHED_DIVIDEND_PAGE_SIZE
  );
  const paginatedInvestmentIntents = paginateItems(
    store.investmentIntents,
    pageFromSearchParams(params, "investmentPage"),
    ADMIN_INTENTS_PAGE_SIZE
  );
  const paginatedWithdrawalIntents = paginateItems(
    store.withdrawalIntents,
    pageFromSearchParams(params, "withdrawalPage"),
    ADMIN_INTENTS_PAGE_SIZE
  );

  return (
    <AppShell>
      <ToastStack messages={adminToastMessages(params)} />

      <Navigation
        title="T-ETF 관리자"
        description="투자/출금 의향서 확인 및 상태 변경"
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

      <SectionHeader
        id="admin-disclosures"
        title="공시"
        description="사용자에게 노출되는 공시와 첨부 거래 이력을 관리합니다."
      />

      <Panel>
        <div className="admin-panel-header">
          <h2>
            <Megaphone size={18} /> 공시 관리
          </h2>
          <DisclosureForm />
        </div>
        <TableSurface>
          <table>
            <thead>
              <tr>
                <th>제목</th>
                <th>첨부 거래</th>
                <th>등록일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDisclosures.items.map((disclosure) => (
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
              {disclosures.length === 0 ? (
                <tr>
                  <td colSpan={4}>등록된 공시가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableSurface>
        <Pagination
          anchor="admin-disclosures"
          label="관리자 공시 페이지"
          pageInfo={paginatedDisclosures.pageInfo}
          pageParam="disclosurePage"
          searchParams={params}
        />
      </Panel>

      <SectionHeader
        id="admin-portfolio"
        title="운영 포트폴리오"
        description="보유 종목, 수량, 현재가, USD 매입환율을 관리합니다."
      />

      <Panel>
        <h2>운영 포트폴리오 관리</h2>
        <TableSurface className="portfolio-table mt-16">
          <table>
            <thead>
              <tr>
                <th>종목</th>
                <th>평가금액</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPortfolioHoldings.items.map((holding) => (
                <tr key={holding.symbol}>
                  <td>
                    <AdminHoldingForm {...holding} />
                  </td>
                  <td>{formatKrw(holding.marketValueKrw)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}>
                  <AdminHoldingForm />
                </td>
              </tr>
            </tbody>
          </table>
        </TableSurface>
        <Pagination
          anchor="admin-portfolio"
          label="운영 포트폴리오 페이지"
          pageInfo={paginatedPortfolioHoldings.pageInfo}
          pageParam="portfolioPage"
          searchParams={params}
        />
      </Panel>

      <SectionHeader
        id="admin-dividends"
        title="배당 데이터"
        description="포트폴리오 종목의 배당 데이터는 외부 데이터로 동기화합니다."
      />

      <Panel>
        <h2>배당 데이터 동기화</h2>
        <TableSurface className="dividend-table">
          <table>
            <thead>
              <tr>
                <th>종목</th>
                <th>연 배당/주</th>
                <th>배당수익률</th>
                <th>지급월</th>
                <th>최근 배당</th>
                <th>동기화</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDividendHoldings.items.map((holding) => {
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
              {portfolio.holdings.length === 0 ? (
                <tr>
                  <td colSpan={6}>포트폴리오 종목이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableSurface>
        <Pagination
          anchor="admin-dividends"
          label="배당 데이터 페이지"
          pageInfo={paginatedDividendHoldings.pageInfo}
          pageParam="dividendPage"
          searchParams={params}
        />
      </Panel>

      {detachedDividendRecords.length > 0 ? (
        <Panel className="mt-12" id="admin-detached-dividends">
          <h2>포트폴리오 외 배당 데이터</h2>
          <TableSurface className="dividend-table compact">
            <table>
              <thead>
                <tr>
                  <th>종목</th>
                  <th>연 배당/주</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDetachedDividendRecords.items.map((record) => (
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
              </tbody>
            </table>
          </TableSurface>
          <Pagination
            anchor="admin-detached-dividends"
            label="포트폴리오 외 배당 데이터 페이지"
            pageInfo={paginatedDetachedDividendRecords.pageInfo}
            pageParam="detachedDividendPage"
            searchParams={params}
          />
        </Panel>
      ) : null}

      <SectionHeader
        id="admin-investments"
        title="투자 의향서"
        description="신청자 정보와 보호자 확인 여부를 보고 상태를 저장합니다."
      />

      <Panel>
        <h2>투자 의향서</h2>
        <TableSurface>
          <table>
            <thead>
              <tr>
                <th>신청자</th>
                <th>금액</th>
                <th>입금자명</th>
                <th>연락처</th>
                <th>보호자</th>
                <th>상태</th>
                <th>제출일</th>
                <th>변경</th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvestmentIntents.items.map((intent) => (
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
                  <td>
                    <Badge tone={statusClass(intent.status)}>{statusLabel(intent.status)}</Badge>
                  </td>
                  <td>{formatDateTime(intent.createdAt)}</td>
                  <td>
                    <StatusForm type="INVESTMENT" id={intent.id} current={intent.status} />
                  </td>
                </tr>
              ))}
              {store.investmentIntents.length === 0 ? (
                <tr>
                  <td colSpan={8}>투자 의향서가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableSurface>
        <Pagination
          anchor="admin-investments"
          label="투자 의향서 페이지"
          pageInfo={paginatedInvestmentIntents.pageInfo}
          pageParam="investmentPage"
          searchParams={params}
        />
      </Panel>

      <SectionHeader
        id="admin-withdrawals"
        title="출금 의향서"
        description="계좌 정보와 연락처를 확인한 뒤 상태를 저장합니다."
      />

      <Panel>
        <h2>출금 의향서</h2>
        <TableSurface>
          <table>
            <thead>
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
            </thead>
            <tbody>
              {paginatedWithdrawalIntents.items.map((intent) => (
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
              {store.withdrawalIntents.length === 0 ? (
                <tr>
                  <td colSpan={8}>출금 의향서가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableSurface>
        <Pagination
          anchor="admin-withdrawals"
          label="출금 의향서 페이지"
          pageInfo={paginatedWithdrawalIntents.pageInfo}
          pageParam="withdrawalPage"
          searchParams={params}
        />
      </Panel>

      <SectionHeader
        title="배당 배분 계산기"
        description="수락된 투자 의향서 하나를 선택하고, 전체 포트폴리오 평가금액 기준 비중으로 실 배당금을 계산합니다."
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
          totalMarketValueKrw={portfolio.totalMarketValueKrw}
        />
      </Panel>
    </AppShell>
  );
}
