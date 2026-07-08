import { promises as fs } from "fs";
import path from "path";
import { ArrowDownToLine, ArrowUpRight, CircleDollarSign, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { AuthNavActions } from "@/app/components/auth-actions";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import { ToastStack, type ToastMessage } from "@/app/components/toast";
import {
  AppShell,
  Badge,
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
import { getManualPortfolioOverview } from "@/lib/portfolio-store";
import { getUserSession } from "@/lib/session";
import { readStore } from "@/lib/store";
import { withdrawalLimitForUser } from "@/lib/withdrawal-limit";
import { TermsAgreement } from "./TermsAgreement";
import { WithdrawalAmountSlider } from "./WithdrawalAmountSlider";

type IntentPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function intentToastMessages(params: Record<string, string | string[] | undefined>): ToastMessage[] {
  const messages: ToastMessage[] = [];
  const error = firstParam(params.error);

  if (params.submitted) {
    messages.push({
      id: "submitted",
      title: "의향서가 제출되었습니다",
      description: "관리자가 확인 후 상태를 변경합니다.",
      tone: "success"
    });
  }
  if (error) {
    const title =
      error === "terms_required"
        ? "약관 동의가 필요합니다"
        : "입력값을 다시 확인해주세요";
    messages.push({
      id: "error",
      title,
      tone: "error"
    });
  }
  return messages;
}

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

export default async function IntentsPage({ searchParams }: IntentPageProps) {
  const user = await getUserSession();
  if (!user) redirect("/?loginRequired=1");

  const params = (await searchParams) ?? {};
  const [portfolio, store, termsMarkdown] = await Promise.all([
    getManualPortfolioOverview(),
    readStore(),
    readProductDescription()
  ]);
  const withdrawalLimit = withdrawalLimitForUser(store, portfolio, user.id);
  const myInvestments = store.investmentIntents.filter((intent) => intent.userId === user.id);
  const myWithdrawals = store.withdrawalIntents.filter((intent) => intent.userId === user.id);
  const myIntents = [...myInvestments, ...myWithdrawals];
  const canRequestWithdrawal = withdrawalLimit.principalKrw > 0;

  return (
    <AppShell>
      <ToastStack messages={intentToastMessages(params)} />

      <Navigation
        title="T-ETF"
        actions={<AuthNavActions user={user} />}
      />

      <Top
        backLink={{ href: "/", label: "포트폴리오" }}
        title="의향서 작성"
        description="투자 의향과 출금 의향을 각각 제출할 수 있습니다. 제출된 내용은 관리자가 검토한 뒤 상태를 변경합니다."
      />

      <Grid columns={3} className="mt-16">
        <Metric label="내 수락된 투자 원금" value={formatKrw(withdrawalLimit.principalKrw)} />
        <Metric label="포트폴리오 하락률 반영" value={formatPercent(withdrawalLimit.drawdownRate)} />
        <Metric label="출금 가능 최대 상한" value={formatKrw(withdrawalLimit.maxAmountKrw)} />
      </Grid>

      <SectionHeader title="의향서 제출" description="연락처에는 전화번호 또는 이메일을 입력해주세요." />

      <Grid columns={2}>
        <Panel>
          <h2>
            <ArrowUpRight size={18} /> 투자 의향서
          </h2>
          <p className="lede">의향 금액은 원화 기준으로 자유롭게 입력할 수 있으며 최소 1만원부터 제출됩니다.</p>
          <Form action="/api/intents/invest" method="post">
            <Field htmlFor="investAmount" label="의향 금액 (원화)">
              <FormattedNumberInput
                id="investAmount"
                min="10000"
                name="amountKrw"
                placeholder="예: 100,000"
                required
              />
              <p className="field-help">원화 기준 1만원 이상, 입력 중 쉼표가 자동으로 표시됩니다.</p>
            </Field>
            <Field htmlFor="depositorName" label="입금자명">
              <input id="depositorName" name="depositorName" defaultValue={user.name} required />
            </Field>
            <Field htmlFor="investContact" label="전화번호 또는 이메일">
              <input id="investContact" name="contact" placeholder="010-0000-0000 또는 name@example.com" required />
            </Field>
            <TermsAgreement markdown={termsMarkdown} />
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
            수락된 투자 원금이 있을 때만 제출할 수 있으며, 포트폴리오 하락률을 반영해 0원부터 최대 상한까지 선택합니다.
          </p>
          <Form action="/api/intents/withdraw" method="post">
            <WithdrawalAmountSlider
              disabled={!canRequestWithdrawal}
              maxAmountKrw={withdrawalLimit.maxAmountKrw}
            />
            {!canRequestWithdrawal ? (
              <Notice className="compact-notice">수락된 투자 의향이 있어야 출금 의향서를 제출할 수 있습니다.</Notice>
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

      <Notice className="mt-18">
        <ShieldAlert size={17} /> 이 서비스는 투자 권유, 투자자문, 자동매매, 금전 보관 기능을 제공하지 않는 의향서
        관리 서비스입니다.
      </Notice>
    </AppShell>
  );
}
