"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { MarketCandle } from "@/lib/market-data";

type ChartPoint = {
  date: string;
  value: number;
};

type ValueFormat = "number" | "krw" | "usd" | "percent";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatValue(value: number, format: ValueFormat) {
  if (format === "krw") {
    return new Intl.NumberFormat("ko-KR", {
      currency: "KRW",
      maximumFractionDigits: 0,
      style: "currency"
    }).format(value);
  }
  if (format === "usd") return `$${formatNumber(value)}`;
  if (format === "percent") return `${formatNumber(value * 100)}%`;
  return formatNumber(value);
}

export function CandleChart({
  candles,
  size = "compact",
  label,
  valueFormat = "number"
}: {
  candles: MarketCandle[];
  size?: "compact" | "detail";
  label?: string;
  valueFormat?: ValueFormat;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(
    size === "detail" && candles.length > 0 ? candles.length - 1 : null
  );

  const metrics = useMemo(() => {
    const width = size === "detail" ? 640 : 148;
    const height = size === "detail" ? 236 : 58;
    if (candles.length === 0) {
      return {
        width,
        height,
        min: 0,
        max: 1,
        range: 1,
        gap: 0,
        candleWidth: 0,
        sidePadding: 0,
        topPadding: size === "detail" ? 18 : 6,
        bottomPadding: size === "detail" ? 34 : 6,
        plotHeight: height - (size === "detail" ? 52 : 12),
        dense: false
      };
    }

    const min = Math.min(...candles.map((candle) => candle.low));
    const max = Math.max(...candles.map((candle) => candle.high));
    const range = max - min || 1;
    const dense = candles.length > (size === "detail" ? 90 : 40);
    const gap = dense ? (size === "detail" ? 0.7 : 0.6) : size === "detail" ? 7 : 4;
    const sidePadding = dense ? (size === "detail" ? 8 : 2) : gap;
    const availableWidth = Math.max(1, width - sidePadding * 2 - gap * Math.max(0, candles.length - 1));
    const candleWidth = Math.max(dense ? 0.45 : size === "detail" ? 5 : 3, availableWidth / candles.length);
    const topPadding = size === "detail" ? 18 : 6;
    const bottomPadding = size === "detail" ? 34 : 6;
    const plotHeight = height - topPadding - bottomPadding;

    return {
      width,
      height,
      min,
      max,
      range,
      gap,
      candleWidth,
      sidePadding,
      topPadding,
      bottomPadding,
      plotHeight,
      dense
    };
  }, [candles, size]);

  if (candles.length === 0) {
    return (
      <div className={size === "detail" ? "candle-chart detail empty-chart" : "candle-chart empty-chart"}>
        차트 데이터 없음
      </div>
    );
  }

  const activeCandle = activeIndex === null ? null : candles[activeIndex];

  function y(value: number) {
    return metrics.topPadding + ((metrics.max - value) / metrics.range) * metrics.plotHeight;
  }

  function x(index: number) {
    return metrics.sidePadding + index * (metrics.candleWidth + metrics.gap);
  }

  function handleMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (candles.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * metrics.width;
    const rawIndex = Math.round((svgX - metrics.sidePadding - metrics.candleWidth / 2) / (metrics.candleWidth + metrics.gap));
    setActiveIndex(Math.min(candles.length - 1, Math.max(0, rawIndex)));
  }

  const activeX =
    activeIndex !== null ? x(activeIndex) + metrics.candleWidth / 2 : 0;
  const axisLabelX = Math.min(metrics.width - 36, Math.max(36, activeX));
  const className = [
    "candle-chart",
    size === "detail" && "detail",
    metrics.dense && "dense"
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      aria-label={label}
      onMouseLeave={() => setActiveIndex(size === "detail" ? candles.length - 1 : null)}
    >
      <svg onMouseMove={handleMouseMove} role="img" viewBox={`0 0 ${metrics.width} ${metrics.height}`}>
        {size === "detail" ? (
          <>
            <line className="chart-grid" x1="0" x2={metrics.width} y1={metrics.topPadding} y2={metrics.topPadding} />
            <line className="chart-grid" x1="0" x2={metrics.width} y1={metrics.height / 2} y2={metrics.height / 2} />
            <line
              className="chart-grid"
              x1="0"
              x2={metrics.width}
              y1={metrics.height - metrics.bottomPadding}
              y2={metrics.height - metrics.bottomPadding}
            />
          </>
        ) : null}
        {candles.map((candle, index) => {
          const itemX = x(index);
          const center = itemX + metrics.candleWidth / 2;
          const up = candle.close >= candle.open;
          const bodyY = Math.min(y(candle.open), y(candle.close));
          const bodyHeight = Math.max(2, Math.abs(y(candle.open) - y(candle.close)));

          return (
            <g
              className={up ? "candle up" : "candle down"}
              key={`${candle.date}-${index}`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              tabIndex={size === "detail" ? 0 : -1}
            >
              <rect
                className="candle-hit-area"
                x={Math.max(0, itemX - metrics.gap / 2)}
                y="0"
                width={metrics.candleWidth + metrics.gap}
                height={metrics.height}
              />
              <line x1={center} x2={center} y1={y(candle.high)} y2={y(candle.low)} />
              <rect x={itemX} y={bodyY} width={metrics.candleWidth} height={bodyHeight} rx={metrics.dense ? 0.8 : 2} />
            </g>
          );
        })}
        {size === "detail" && activeIndex !== null && activeCandle ? (
          <>
            <line
              className="chart-active-line"
              x1={activeX}
              x2={activeX}
              y1={metrics.topPadding}
              y2={metrics.height - metrics.bottomPadding}
            />
            <text className="chart-axis-label" x={axisLabelX} y={metrics.height - 8}>
              {formatDate(activeCandle.date)}
            </text>
          </>
        ) : null}
      </svg>
      {size === "detail" && activeCandle ? (
        <div className="chart-tooltip">
          <strong>{formatDate(activeCandle.date)}</strong>
          <span>시가 {formatValue(activeCandle.open, valueFormat)}</span>
          <span>고가 {formatValue(activeCandle.high, valueFormat)}</span>
          <span>저가 {formatValue(activeCandle.low, valueFormat)}</span>
          <span>종가 {formatValue(activeCandle.close, valueFormat)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function SparkLineChart({
  points,
  label,
  valueFormat = "number",
  interactive = true
}: {
  points: ChartPoint[];
  label?: string;
  valueFormat?: ValueFormat;
  interactive?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return <div className="sparkline-chart empty-chart">데이터 없음</div>;
  }

  const width = 160;
  const height = 46;
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const range = max - min || 1;
  const activePoint = interactive && activeIndex !== null ? points[activeIndex] : null;

  function x(index: number) {
    return points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
  }

  function y(value: number) {
    return 5 + ((max - value) / range) * (height - 10);
  }

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`)
    .join(" ");

  const isUp = points.at(-1)!.value >= points[0]!.value;

  return (
    <div className="sparkline-chart" aria-label={label} onMouseLeave={() => interactive && setActiveIndex(null)}>
      <svg role="img" viewBox={`0 0 ${width} ${height}`}>
        <path className={isUp ? "sparkline-path up" : "sparkline-path down"} d={path} />
        {interactive
          ? points.map((point, index) => (
              <rect
                className="sparkline-hit-area"
                key={`${point.date}-${index}`}
                x={Math.max(0, x(index) - width / points.length / 2)}
                y="0"
                width={Math.max(8, width / points.length)}
                height={height}
                onMouseEnter={() => setActiveIndex(index)}
              />
            ))
          : null}
        {activePoint ? (
          <circle
            className={isUp ? "sparkline-dot up" : "sparkline-dot down"}
            cx={x(activeIndex ?? 0)}
            cy={y(activePoint.value)}
            r="3"
          />
        ) : null}
      </svg>
      {activePoint ? (
        <div className="sparkline-tooltip">
          {formatDate(activePoint.date)} · {formatValue(activePoint.value, valueFormat)}
        </div>
      ) : null}
    </div>
  );
}
