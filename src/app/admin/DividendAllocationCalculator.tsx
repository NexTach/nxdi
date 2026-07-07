"use client";

import { useMemo, useState } from "react";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import { Field, MutedText } from "@/app/components/tds";
import { formatDateTime, formatKrw, formatNumber } from "@/lib/format";

type DividendAllocationIntent = {
  id: string;
  userName: string;
  userEmail: string;
  amountKrw: number;
  createdAt: string;
};

type DividendAllocationCalculatorProps = {
  intents: DividendAllocationIntent[];
  totalMarketValueKrw: number;
};

function parseInputAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${formatNumber(value * 100, 4)}%`;
}

export function DividendAllocationCalculator({
  intents,
  totalMarketValueKrw
}: DividendAllocationCalculatorProps) {
  const [actualDividend, setActualDividend] = useState("");
  const [selectedIntentId, setSelectedIntentId] = useState(() => intents[0]?.id ?? "");
  const actualDividendKrw = parseInputAmount(actualDividend);

  const selectedIntent = useMemo(
    () => intents.find((intent) => intent.id === selectedIntentId) ?? intents[0],
    [intents, selectedIntentId]
  );
  const selectedPortfolioWeight =
    selectedIntent && totalMarketValueKrw > 0 ? selectedIntent.amountKrw / totalMarketValueKrw : 0;
  const allocationKrw = actualDividendKrw * selectedPortfolioWeight;
  const canCalculate = totalMarketValueKrw > 0 && Boolean(selectedIntent);

  return (
    <div className="dividend-allocation-calculator">
      <div className="dividend-allocation-controls">
        <Field htmlFor="dividend-allocation-intent" label="수락된 투자 의향서">
          <select
            id="dividend-allocation-intent"
            value={selectedIntent?.id ?? ""}
            onChange={(event) => setSelectedIntentId(event.target.value)}
            disabled={intents.length === 0}
          >
            {intents.length === 0 ? <option value="">수락된 의향서 없음</option> : null}
            {intents.map((intent) => (
              <option key={intent.id} value={intent.id}>
                {intent.userName} · {formatKrw(intent.amountKrw)} · {formatDateTime(intent.createdAt)}
              </option>
            ))}
          </select>
        </Field>
        <Field htmlFor="actual-dividend-krw" label="실 배당 금액">
          <FormattedNumberInput
            id="actual-dividend-krw"
            min="0"
            onValueChange={setActualDividend}
            placeholder="원화 기준 배당금"
            value={actualDividend}
          />
        </Field>
      </div>

      <div className="dividend-allocation-summary" aria-label="배당 배분 요약">
        <div>
          <span>포트폴리오 평가금액</span>
          <strong>{formatKrw(totalMarketValueKrw)}</strong>
        </div>
        <div>
          <span>선택 의향 금액</span>
          <strong>{selectedIntent ? formatKrw(selectedIntent.amountKrw) : "-"}</strong>
        </div>
        <div>
          <span>평가금액 기준 비중</span>
          <strong>{formatPercent(selectedPortfolioWeight)}</strong>
        </div>
        <div>
          <span>지급액</span>
          <strong>{formatKrw(allocationKrw)}</strong>
        </div>
      </div>

      {!canCalculate ? (
        <p className="dividend-allocation-empty">
          {totalMarketValueKrw <= 0
            ? "포트폴리오 평가금액이 있어야 배당 배분액을 계산할 수 있습니다."
            : "수락된 투자 의향서가 없습니다."}
        </p>
      ) : (
        <div className="dividend-allocation-selected">
          <div>
            <span>선택된 의향서</span>
            <strong>{selectedIntent.userName}</strong>
            <MutedText>{selectedIntent.userEmail}</MutedText>
          </div>
          <div>
            <span>제출일</span>
            <strong>{formatDateTime(selectedIntent.createdAt)}</strong>
          </div>
          <div>
            <span>계산식</span>
            <strong>
              {formatKrw(actualDividendKrw)} × {formatPercent(selectedPortfolioWeight)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
