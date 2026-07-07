"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { formatKrw } from "@/lib/format";

type SliderStyle = CSSProperties & {
  "--withdrawal-slider-progress": string;
};

export function WithdrawalAmountSlider({
  maxAmountKrw,
  disabled = false
}: {
  maxAmountKrw: number;
  disabled?: boolean;
}) {
  const normalizedMax = Math.max(0, Math.floor(maxAmountKrw));
  const [amount, setAmount] = useState(normalizedMax);
  const isDisabled = disabled || normalizedMax <= 0;
  const progress = useMemo(() => {
    if (normalizedMax <= 0) return "0%";
    return `${Math.min(100, Math.max(0, (amount / normalizedMax) * 100))}%`;
  }, [amount, normalizedMax]);

  const value = Math.min(amount, normalizedMax);

  return (
    <div className="withdrawal-slider">
      <input type="hidden" name="amountKrw" value={value} />
      <div className="withdrawal-slider-value">
        <span>출금 의향 금액 (원화)</span>
        <output htmlFor="withdrawAmount">{formatKrw(value)}</output>
      </div>
      <input
        aria-label="출금 의향 금액"
        disabled={isDisabled}
        id="withdrawAmount"
        max={normalizedMax}
        min={0}
        onChange={(event) => setAmount(Number(event.currentTarget.value))}
        style={{ "--withdrawal-slider-progress": progress } as SliderStyle}
        type="range"
        value={value}
      />
      <div className="withdrawal-slider-scale">
        <span>{formatKrw(0)}</span>
        <span>{formatKrw(normalizedMax)}</span>
      </div>
    </div>
  );
}
