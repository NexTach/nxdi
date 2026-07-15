"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, MutedText, TdsSelect } from "@/app/components/tds";
import { calculateDividendAllocation } from "@/lib/dividend-allocation";
import { intentBasedDividendPrincipal } from "@/lib/dividend-principal";
import { formatDateTime, formatKrw, formatNumber } from "@/lib/format";

type DividendAllocationIntent = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amountKrw: number;
  createdAt: string;
  updatedAt: string;
  eligibleFromMonth: string;
};

type DividendAllocationWithdrawal = {
  id: string;
  userId: string;
  amountKrw: number;
  acceptedAt: string;
};

type DividendAllocationCalculatorProps = {
  companyDividendTransferRate: number;
  managementFeeRate: number;
  intents: DividendAllocationIntent[];
  withdrawals: DividendAllocationWithdrawal[];
  defaultDividendMonth: string;
  monthlyInvestorDividendCapRate: number;
  receiptSummaryRevision: string;
  totalMarketValueKrw: number;
};

type DistributionReceiptSummary = {
  dividendMonth: string;
  actualDividendKrw: number;
  receiptCount: number;
};

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${formatNumber(value * 100, 4)}%`;
}

export function DividendAllocationCalculator({
  companyDividendTransferRate,
  managementFeeRate,
  intents,
  withdrawals,
  defaultDividendMonth,
  monthlyInvestorDividendCapRate,
  receiptSummaryRevision,
  totalMarketValueKrw
}: DividendAllocationCalculatorProps) {
  const [dividendMonth, setDividendMonth] = useState(defaultDividendMonth);
  const [selectedIntentId, setSelectedIntentId] = useState(() => intents[0]?.id ?? "");
  const [receiptSummary, setReceiptSummary] = useState<DistributionReceiptSummary | null>(null);
  const [receiptSummaryLoading, setReceiptSummaryLoading] = useState(true);
  const [receiptSummaryError, setReceiptSummaryError] = useState(false);
  const actualDividendKrw = receiptSummary?.dividendMonth === dividendMonth
    ? receiptSummary.actualDividendKrw
    : 0;
  const receiptCount = receiptSummary?.dividendMonth === dividendMonth
    ? receiptSummary.receiptCount
    : 0;

  useEffect(() => {
    const controller = new AbortController();

    async function loadReceiptSummary() {
      setReceiptSummary(null);
      setReceiptSummaryLoading(true);
      setReceiptSummaryError(false);
      try {
        const response = await fetch(
          `/api/admin/dividends/receipts/summary?dividendMonth=${encodeURIComponent(dividendMonth)}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            signal: controller.signal
          }
        );
        const payload = (await response.json()) as DistributionReceiptSummary | { error?: string };
        if (
          !response.ok ||
          !("actualDividendKrw" in payload) ||
          typeof payload.actualDividendKrw !== "number" ||
          typeof payload.receiptCount !== "number"
        ) {
          throw new Error("실분배금 원장 합계를 조회하지 못했습니다.");
        }
        setReceiptSummary(payload);
      } catch {
        if (!controller.signal.aborted) setReceiptSummaryError(true);
      } finally {
        if (!controller.signal.aborted) setReceiptSummaryLoading(false);
      }
    }

    void loadReceiptSummary();
    return () => controller.abort();
  }, [dividendMonth, receiptSummaryRevision]);

  const eligibleIntents = useMemo(
    () => intentBasedDividendPrincipal(intents, withdrawals, dividendMonth),
    [dividendMonth, intents, withdrawals]
  );
  const investorPrincipalKrw = eligibleIntents.reduce((sum, intent) => sum + intent.amountKrw, 0);

  const selectedIntent = useMemo(
    () => eligibleIntents.find((intent) => intent.id === selectedIntentId) ?? eligibleIntents[0],
    [eligibleIntents, selectedIntentId]
  );
  const allocation = calculateDividendAllocation({
    actualDividendKrw,
    selectedInvestmentKrw: selectedIntent?.amountKrw ?? 0,
    investorPrincipalKrw,
    totalMarketValueKrw,
    companyDividendTransferRate,
    managementFeeRate,
    monthlyInvestorDividendCapRate
  });
  const canCalculate =
    investorPrincipalKrw > 0 &&
    Boolean(selectedIntent) &&
    receiptCount > 0 &&
    !receiptSummaryLoading &&
    !receiptSummaryError;
  const receiptSummaryHelp = receiptSummaryLoading
    ? "선택한 지급월의 원장 합계를 불러오고 있습니다."
    : receiptSummaryError
      ? "원장 합계를 불러오지 못했습니다. 잠시 후 지급월을 다시 선택해 주세요."
      : `종목별 실분배금 입금 원장 ${receiptCount}건의 원화 순입금 합계이며, 반대분개는 제외합니다.`;
  const unavailableMessage = receiptSummaryLoading
    ? "선택한 지급월의 실분배금 원장 합계를 불러오고 있습니다."
    : receiptSummaryError
      ? "실분배금 원장 합계를 불러온 뒤 계산할 수 있습니다."
      : receiptCount <= 0
        ? "선택한 지급월에 유효한 종목별 실분배금 입금 원장이 없습니다."
        : investorPrincipalKrw <= 0
          ? "선택한 지급월에 참고 계산할 수락 투자 의향 잔액이 없습니다."
          : "배당 대상 투자 의향서가 없습니다.";

  return (
    <div className="dividend-allocation-calculator">
      <div className="dividend-allocation-controls">
        <Field htmlFor="dividend-allocation-month" label="배당 지급월">
          <input
            id="dividend-allocation-month"
            onChange={(event) => setDividendMonth(event.currentTarget.value)}
            type="month"
            value={dividendMonth}
          />
          <p className="field-help">의향 수락월의 다음 달부터 포함하고, 수락된 출금 의향은 FIFO로 차감한 참고 계산입니다.</p>
        </Field>
        <Field htmlFor="dividend-allocation-intent" label="수락된 투자 의향서">
          <TdsSelect
            id="dividend-allocation-intent"
            value={selectedIntent?.id ?? ""}
            onChange={(event) => setSelectedIntentId(event.target.value)}
            disabled={eligibleIntents.length === 0}
          >
            {eligibleIntents.length === 0 ? <option value="">배당 대상 의향서 없음</option> : null}
            {eligibleIntents.map((intent) => (
              <option key={intent.id} value={intent.id}>
                {intent.userName} · {formatKrw(intent.amountKrw)} · {formatDateTime(intent.createdAt)}
              </option>
            ))}
          </TdsSelect>
        </Field>
        <Field htmlFor="actual-dividend-krw" label="월 전체 실 배당금">
          <input
            aria-busy={receiptSummaryLoading}
            id="actual-dividend-krw"
            readOnly
            value={
              receiptSummaryLoading
                ? "원장 합계 조회 중"
                : receiptSummaryError
                  ? "원장 합계 조회 실패"
                  : formatKrw(actualDividendKrw)
            }
          />
          <p className="field-help">{receiptSummaryHelp}</p>
        </Field>
      </div>

      <div className="dividend-allocation-summary" aria-label="배당 배분 요약">
        <div>
          <span>의향 기반 가정원금 합계</span>
          <strong>{formatKrw(allocation.investorPrincipalKrw)}</strong>
        </div>
        <div>
          <span>회사 기준금액</span>
          <strong>{formatKrw(allocation.companyPrincipalKrw)}</strong>
        </div>
        <div>
          <span>투자자 기본 몫</span>
          <strong>{formatKrw(allocation.investorBaseDividendKrw)}</strong>
        </div>
        <div>
          <span>회사 이전액</span>
          <strong>{formatKrw(allocation.companyTransferredDividendKrw)}</strong>
        </div>
        <div>
          <span>운용보수</span>
          <strong>{formatKrw(allocation.managementFeeKrw)}</strong>
        </div>
        <div>
          <span>투자자 배분 대상</span>
          <strong>{formatKrw(allocation.investorDistributionPoolKrw)}</strong>
        </div>
        <div>
          <span>배당 재투자금</span>
          <strong>{formatKrw(allocation.investorReinvestmentPoolKrw)}</strong>
        </div>
        <div>
          <span>회사 보유 배당</span>
          <strong>{formatKrw(allocation.companyRetainedDividendKrw)}</strong>
        </div>
        <div>
          <span>선택 투자자 비율</span>
          <strong>{formatPercent(allocation.selectedInvestorWeight)}</strong>
        </div>
        <div>
          <span>지급액</span>
          <strong>{formatKrw(allocation.allocationKrw)}</strong>
        </div>
        <div>
          <span>선택 의향 재투자액</span>
          <strong>{formatKrw(allocation.selectedInvestorReinvestmentKrw)}</strong>
        </div>
      </div>

      {!canCalculate ? (
        <p className="dividend-allocation-empty">{unavailableMessage}</p>
      ) : (
        <div className="dividend-allocation-selected">
          <div>
            <span>선택된 의향서</span>
            <strong>{selectedIntent.userName}</strong>
            <MutedText>{selectedIntent.userEmail}</MutedText>
          </div>
          <div>
            <span>수락 기준일</span>
            <strong>{formatDateTime(selectedIntent.updatedAt)}</strong>
          </div>
          <div>
            <span>계산식</span>
            <strong>
              {formatKrw(allocation.investorDistributionPoolKrw)} ×{" "}
              {formatPercent(allocation.selectedInvestorWeight)}
            </strong>
            <MutedText>
              상한 {formatPercent(allocation.monthlyInvestorDividendCapRate)} · 이전율{" "}
              {formatPercent(allocation.companyDividendTransferRate)} · 보수율{" "}
              {formatPercent(allocation.managementFeeRate)}
            </MutedText>
          </div>
          <MutedText>
            의향서의 수락은 계약 체결·입금 확인이 아닙니다. 이 결과는 연락 및 내부 검토용 참고치이며 실제 원금·분배금 확정에 사용할 수 없습니다.
          </MutedText>
        </div>
      )}
    </div>
  );
}
