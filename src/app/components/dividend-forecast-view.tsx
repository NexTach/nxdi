"use client";

import { useMemo, useState } from "react";
import { Empty, List, ListRow, RowMeta } from "@/app/components/tds";
import { formatKrw, formatNumber } from "@/lib/format";
import { stockPrimaryLabel, stockSecondaryLabel } from "@/lib/stock-display";
import type { DividendForecastLine } from "@/lib/types";

type ForecastView = "monthly" | "stock";

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function monthlyAmount(line: DividendForecastLine) {
  if (line.expectedPaymentMonths.length === 0) return line.annualDividendKrw;
  return line.annualDividendKrw / line.expectedPaymentMonths.length;
}

export function DividendForecastView({ lines }: { lines: DividendForecastLine[] }) {
  const [view, setView] = useState<ForecastView>("monthly");
  const monthlyRows = useMemo(
    () =>
      MONTHS.map((month) => {
        const items = lines.filter((line) => line.expectedPaymentMonths.includes(month));
        return {
          month,
          items,
          amountKrw: items.reduce((sum, line) => sum + monthlyAmount(line), 0)
        };
      }).filter((row) => row.items.length > 0),
    [lines]
  );
  const unscheduledLines = lines.filter(
    (line) => line.annualDividendKrw > 0 && line.expectedPaymentMonths.length === 0
  );

  return (
    <section className="forecast-view">
      <div className="tabs" role="tablist" aria-label="예상 배당 보기">
        <button
          className={`tab ${view === "monthly" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={view === "monthly"}
          onClick={() => setView("monthly")}
        >
          월별
        </button>
        <button
          className={`tab ${view === "stock" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={view === "stock"}
          onClick={() => setView("stock")}
        >
          종목별
        </button>
      </div>

      {view === "monthly" ? (
        <List>
          {monthlyRows.map((row) => (
            <ListRow
              key={row.month}
              title={`${row.month}월`}
              description={row.items.map((line) => stockPrimaryLabel(line)).join(", ")}
              value={
                <>
                  {formatKrw(row.amountKrw)}
                  <RowMeta>{row.items.length}개 종목</RowMeta>
                </>
              }
            />
          ))}
          {unscheduledLines.length > 0 ? (
            <ListRow
              title="지급월 없음"
              description={unscheduledLines.map((line) => stockPrimaryLabel(line)).join(", ")}
              value={
                <>
                  {formatKrw(unscheduledLines.reduce((sum, line) => sum + line.annualDividendKrw, 0))}
                  <RowMeta>{unscheduledLines.length}개 종목</RowMeta>
                </>
              }
            />
          ) : null}
          {monthlyRows.length === 0 && unscheduledLines.length === 0 ? <Empty>예상 배당 데이터가 없습니다.</Empty> : null}
        </List>
      ) : (
        <List>
          {lines.map((line) => {
            const secondaryLabel = stockSecondaryLabel(line);
            return (
              <ListRow
                key={line.symbol}
                title={stockPrimaryLabel(line)}
                description={`${secondaryLabel ? `${secondaryLabel} · ` : ""}배정 ${formatKrw(line.allocationKrw)} · 예상 ${formatNumber(line.estimatedQuantity, 5)}주`}
                value={
                  <>
                    {formatKrw(line.monthlyAverageKrw)}
                    <RowMeta>
                      연 {formatKrw(line.annualDividendKrw)} ·{" "}
                      {line.expectedPaymentMonths.length > 0
                        ? line.expectedPaymentMonths.map((month) => `${month}월`).join(", ")
                        : "지급월 없음"}
                    </RowMeta>
                  </>
                }
              />
            );
          })}
          {lines.length === 0 ? <Empty>예상 배당 데이터가 없습니다.</Empty> : null}
        </List>
      )}
    </section>
  );
}
