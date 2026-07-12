import { promises as fs } from "fs";
import path from "path";
import { ArrowDownToLine, ArrowUpRight, CircleDollarSign, LockKeyhole } from "lucide-react";
import { AuthNavActions, DataGsmLoginButton } from "@/app/components/auth-actions";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import { ToastStack, type ToastMessage } from "@/app/components/toast";
import {
  AppShell,
  Badge,
  CtaPanel,
  Empty,
  Field,
  Form,
  Grid,
  List,
  ListRow,
  Metric,
  Navigation,
  Notice,
  Panel,
  RowMeta,
  SectionHeader,
  Top
} from "@/app/components/tds";
import { formatDateTime, formatKrw, formatNumber, statusLabel } from "@/lib/format";
import { FLASH_COOKIE_NAME, getFlashMessages } from "@/lib/flash";
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { PRODUCT_MAX_INVESTMENT_KRW, PRODUCT_MIN_INVESTMENT_KRW } from "@/lib/product-policy";
import { getUserSession } from "@/lib/session";
import { readStore } from "@/lib/store";
import { withdrawalLimitForUser } from "@/lib/withdrawal-limit";
import { TermsAgreement } from "./TermsAgreement";
import { WithdrawalAmountSlider } from "./WithdrawalAmountSlider";

function statusClass(status: string): "accepted" | "rejected" | "pending" {
  if (status === "ACCEPTED") return "accepted";
  if (status === "REJECTED") return "rejected";
  return "pending";
}

function formatPercent(value: number) {
  return `${formatNumber(value * 100, 2)}%`;
}

async function readProductDescription() {
  const filePath = path.join(process.cwd(), "content", "product-description.md");
  return fs.readFile(filePath, "utf8");
}

async function readDividendPolicy() {
  const filePath = path.join(process.cwd(), "content", "dividend-policy.md");
  return fs.readFile(filePath, "utf8");
}

function IntentGate({ messages }: { messages: ToastMessage[] }) {
  return (
    <AppShell>
      <ToastStack messages={messages} clearCookieName={FLASH_COOKIE_NAME} />

      <Navigation
        title="의향서 로그인"
        actions={<AuthNavActions user={null} />}
      />

      <Top
        title="로그인이 필요해요"
        description="투자 의향서와 출금 의향서는 DataGSM 인증 후 작성할 수 있습니다."
        backLink={{ href: "/" }}
      />

      <CtaPanel className="max-w-gate">
        <h2>
          <LockKeyhole size={18} /> DataGSM 인증 필요
        </h2>
        <p className="lede">
          DataGSM으로 로그인한 뒤 의향서를 작성하고 제출 내역을 확인할 수 있습니다.
        </p>
        <DataGsmLoginButton />
      </CtaPanel>
    </AppShell>
  );
}

export default async function IntentsPage() {
  const user = await getUserSession();
  const flashMessages = await getFlashMessages();
  if (!user) return <IntentGate messages={flashMessages} />;

  const [portfolio, store, termsMarkdown, dividendPolicyMarkdown] = await Promise.all([
    getManualPortfolioOverview(),
    readStore(),
    readProductDescription(),
    readDividendPolicy()
  ]);
  const withdrawalLimit = withdrawalLimitForUser(store, portfolio, user.id);
  const myInvestments = store.investmentIntents.filter((intent) => intent.userId === user.id);
  const myWithdrawals = store.withdrawalIntents.filter((intent) => intent.userId === user.id);
  const myIntents = [...myInvestments, ...myWithdrawals];
  const canRequestWithdrawal = withdrawalLimit.maxAmountKrw > 0;

  return (
    <AppShell>
      <ToastStack messages={flashMessages} clearCookieName={FLASH_COOKIE_NAME} />

      <Navigation
        title="TDIV"
        actions={<AuthNavActions user={user} />}
      />

      <Top
        backLink={{ href: "/", label: "포트폴리오" }}
        title="의향서 작성"
        description="투자 의향과 출금 의향을 각각 제출할 수 있습니다. 제출된 내용은 관리자가 검토한 뒤 상태를 변경합니다."
      />

      <Grid columns={4} className="mt-16">
        <Metric label="내 잔여 승인 원금" value={formatKrw(withdrawalLimit.principalKrw)} />
        <Metric label="대기 중 출금" value={formatKrw(withdrawalLimit.pendingWithdrawalKrw)} />
        <Metric label="포트폴리오 하락률 반영" value={formatPercent(withdrawalLimit.drawdownRate)} />
        <Metric label="출금 가능 최대 상한" value={formatKrw(withdrawalLimit.maxAmountKrw)} />
      </Grid>

      <SectionHeader title="의향서 제출" description="연락처에는 전화번호 또는 이메일을 입력해주세요." />

      <Grid columns={2}>
        <Panel>
          <h2>
            <ArrowUpRight size={18} /> 투자 의향서
          </h2>
          <p className="lede">의향 금액은 1회 기준 최소 1만원부터 최대 100만원까지 제출할 수 있습니다.</p>
          <Form action="/api/intents/invest" method="post">
            <Field htmlFor="investAmount" label="의향 금액 (원화)">
              <FormattedNumberInput
                id="investAmount"
                max={PRODUCT_MAX_INVESTMENT_KRW}
                min={PRODUCT_MIN_INVESTMENT_KRW}
                name="amountKrw"
                placeholder="예: 100,000"
                required
              />
              <p className="field-help">원화 기준 1만원 이상 100만원 이하이며, 입력 중 쉼표가 자동으로 표시됩니다.</p>
            </Field>
            <Field htmlFor="depositorName" label="입금자명">
              <input id="depositorName" name="depositorName" defaultValue={user.name} required />
            </Field>
            <Field htmlFor="investContact" label="전화번호 또는 이메일">
              <input id="investContact" name="contact" placeholder="010-0000-0000 또는 name@example.com" required />
            </Field>
            <TermsAgreement markdown={termsMarkdown} />
            <TermsAgreement
              markdown={dividendPolicyMarkdown}
              modalDescription="투자 의향서 제출 전 확인해야 하는 배당 산정 원문입니다."
              name="dividendPolicyAgreed"
              title="배당 정책"
              label="을 읽었고 배당금이 보장되지 않는다는 점에 동의합니다."
            />
            <Field htmlFor="investNote" label="메모">
              <textarea id="investNote" name="note" />
            </Field>
            <button type="submit">
              <CircleDollarSign size={17} />
              제출
            </button>
          </Form>
        </Panel>

        <Panel>
          <h2>
            <ArrowDownToLine size={18} /> 출금 의향서
          </h2>
          <p className="lede">
            잔여 승인 원금이 있을 때만 제출할 수 있으며, 승인·대기 출금과 포트폴리오 하락률을 반영한 상한 안에서 선택합니다.
          </p>
          <Form action="/api/intents/withdraw" method="post">
            <WithdrawalAmountSlider
              disabled={!canRequestWithdrawal}
              maxAmountKrw={withdrawalLimit.maxAmountKrw}
            />
            {!canRequestWithdrawal ? (
              <Notice className="compact-notice">승인·대기 출금과 포트폴리오 하락률을 반영한 출금 가능 금액이 없습니다.</Notice>
            ) : null}
            <Field htmlFor="bankName" label="은행">
              <input id="bankName" name="bankName" required disabled={!canRequestWithdrawal} />
            </Field>
            <Field htmlFor="accountNumber" label="계좌번호">
              <input id="accountNumber" name="accountNumber" inputMode="numeric" required disabled={!canRequestWithdrawal} />
            </Field>
            <Field htmlFor="accountHolder" label="예금주">
              <input id="accountHolder" name="accountHolder" defaultValue={user.name} required disabled={!canRequestWithdrawal} />
            </Field>
            <Field htmlFor="withdrawContact" label="전화번호 또는 이메일">
              <input
                disabled={!canRequestWithdrawal}
                id="withdrawContact"
                name="contact"
                placeholder="010-0000-0000 또는 name@example.com"
                required
              />
            </Field>
            <Field htmlFor="withdrawNote" label="메모">
              <textarea id="withdrawNote" name="note" disabled={!canRequestWithdrawal} />
            </Field>
            <TermsAgreement markdown={termsMarkdown} disabled={!canRequestWithdrawal} />
            <button type="submit" disabled={!canRequestWithdrawal}>
              제출
            </button>
          </Form>
        </Panel>
      </Grid>

      <SectionHeader title="내 제출 내역" description="투자와 출금 의향서 상태를 한곳에서 확인합니다." />

      <List>
        {myIntents.map((intent) => (
          <ListRow
            key={intent.id}
            title={intent.type === "INVESTMENT" ? "투자 의향" : "출금 의향"}
            description={formatDateTime(intent.createdAt)}
            value={
              <>
                {formatKrw(intent.amountKrw)}
                <RowMeta>
                  <Badge tone={statusClass(intent.status)}>{statusLabel(intent.status)}</Badge>
                </RowMeta>
              </>
            }
          />
        ))}
        {myIntents.length === 0 ? <Empty>제출 내역이 없습니다.</Empty> : null}
      </List>
    </AppShell>
  );
}
