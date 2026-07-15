"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiMutationForm } from "@/app/components/api-mutation-form";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import { RiskBadge } from "@/app/components/risk-badge";
import { ComputedValue, Field, TdsSelect } from "@/app/components/tds";
import { currencySymbol, formatCurrency } from "@/lib/format";
import { stockPrimaryLabel, stockSecondaryLabel } from "@/lib/stock-display";
import type { Holding, MarketCode, TradeSide } from "@/lib/types";

type SearchResult = {
  symbol: string;
  name: string;
  exchange?: string;
  currency?: "KRW" | "USD";
  marketCountry?: MarketCode;
  lastPrice?: number;
  source: string;
};

type AdminHoldingFormProps = Partial<Pick<
  Holding,
  | "symbol"
  | "name"
  | "alias"
  | "marketCountry"
  | "currency"
  | "quantity"
  | "lastPrice"
  | "averagePurchasePrice"
  | "purchaseExchangeRate"
  | "riskLevel"
>>;

type HoldingFormState = {
  symbol: string;
  name: string;
  alias: string;
  marketCountry: MarketCode;
  currency: "KRW" | "USD";
  quantity: string;
  lastPrice: string;
  averagePurchasePrice: string;
  purchaseExchangeRate: string;
  riskLevel: "" | "LOW" | "HIGH";
};

type TradeFormState = {
  side: TradeSide;
  quantity: string;
  orderPrice: string;
  exchangeRate: string;
};

function currentKstDateTimeLocal() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 16);
}

function profitLossRate(lastPrice?: number, averagePurchasePrice?: number) {
  if (!lastPrice || !averagePurchasePrice) return null;
  return ((lastPrice - averagePurchasePrice) / averagePurchasePrice) * 100;
}

function formatHoldingNumber(value?: number, digits = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits
  }).format(value);
}

function formatHoldingCurrency(value: number | undefined, currency: "KRW" | "USD" | undefined, digits = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return formatCurrency(value, currency ?? "USD", digits);
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeMarketCode(value?: string, currency?: "KRW" | "USD", symbol?: string): MarketCode {
  if (value === "NASDAQ" || value === "NYSE" || value === "AMEX" || value === "KOSPI" || value === "KOSDAQ") {
    return value;
  }
  if (currency === "KRW") return symbol?.toUpperCase().endsWith(".KQ") ? "KOSDAQ" : "KOSPI";
  return "NASDAQ";
}

function currencyFromMarket(market: MarketCode): "KRW" | "USD" {
  return market === "KOSPI" || market === "KOSDAQ" ? "KRW" : "USD";
}

function marketLabel(market?: MarketCode) {
  if (market === "NYSE") return "뉴욕증권거래소";
  if (market === "AMEX") return "아메리칸증권거래소";
  if (market === "KOSPI") return "유가증권시장";
  if (market === "KOSDAQ") return "코스닥시장";
  return "나스닥";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function createHoldingFormState({
  symbol,
  name,
  alias,
  marketCountry,
  currency,
  quantity,
  lastPrice,
  averagePurchasePrice,
  purchaseExchangeRate,
  riskLevel
}: AdminHoldingFormProps): HoldingFormState {
  const normalizedMarket = normalizeMarketCode(marketCountry, currency, symbol);

  return {
    symbol: symbol ?? "",
    name: name ?? "",
    alias: alias ?? "",
    marketCountry: normalizedMarket,
    currency: currency ?? currencyFromMarket(normalizedMarket),
    quantity: quantity?.toString() ?? "",
    lastPrice: lastPrice?.toString() ?? "",
    averagePurchasePrice: averagePurchasePrice?.toString() ?? "",
    purchaseExchangeRate: purchaseExchangeRate?.toString() ?? "",
    riskLevel: riskLevel ?? ""
  };
}

function createTradeFormState({
  lastPrice,
  purchaseExchangeRate
}: Pick<AdminHoldingFormProps, "lastPrice" | "purchaseExchangeRate">): TradeFormState {
  return {
    side: "BUY",
    quantity: "",
    orderPrice: lastPrice?.toString() ?? "",
    exchangeRate: purchaseExchangeRate?.toString() ?? ""
  };
}

export function AdminHoldingForm({
  symbol,
  name,
  alias,
  marketCountry,
  currency,
  quantity,
  lastPrice,
  averagePurchasePrice,
  purchaseExchangeRate,
  riskLevel
}: AdminHoldingFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const searchFailureTimeoutRef = useRef<number | null>(null);
  const initialForm = useMemo(
    () =>
      createHoldingFormState({
        symbol,
        name,
        alias,
        marketCountry,
        currency,
        quantity,
        lastPrice,
        averagePurchasePrice,
        purchaseExchangeRate,
        riskLevel
      }),
    [alias, averagePurchasePrice, currency, lastPrice, marketCountry, name, purchaseExchangeRate, quantity, riskLevel, symbol]
  );
  const [form, setForm] = useState<HoldingFormState>(initialForm);
  const initialTradeForm = useMemo(
    () => createTradeFormState({ lastPrice, purchaseExchangeRate }),
    [lastPrice, purchaseExchangeRate]
  );
  const [tradeForm, setTradeForm] = useState<TradeFormState>(initialTradeForm);

  const computedRate = useMemo(
    () => profitLossRate(Number(form.lastPrice), Number(form.averagePurchasePrice)),
    [form.averagePurchasePrice, form.lastPrice]
  );
  const tradePreview = useMemo(() => {
    const tradeQuantity = positiveNumber(tradeForm.quantity);
    const tradePrice = positiveNumber(tradeForm.orderPrice);
    const currentQuantity = quantity ?? 0;
    const currentAveragePrice = averagePurchasePrice && averagePurchasePrice > 0 ? averagePurchasePrice : lastPrice;

    if (!tradeQuantity || !tradePrice || (tradeForm.side === "SELL" && !currentQuantity)) {
      return {
        isValid: false,
        quantity: undefined,
        averagePurchasePrice,
        purchaseExchangeRate
      };
    }

    if (tradeForm.side === "SELL") {
      const nextQuantity = currentQuantity - tradeQuantity;
      return {
        isValid: nextQuantity >= -0.0000001,
        quantity: Math.max(0, nextQuantity),
        averagePurchasePrice,
        purchaseExchangeRate
      };
    }

    const currentNativeCost = (currentAveragePrice ?? tradePrice) * currentQuantity;
    const tradeNativeCost = tradePrice * tradeQuantity;
    const nextQuantity = currentQuantity + tradeQuantity;
    const nextAveragePurchasePrice = (currentNativeCost + tradeNativeCost) / nextQuantity;
    const tradeExchangeRate = positiveNumber(tradeForm.exchangeRate);
    let nextPurchaseExchangeRate = purchaseExchangeRate;

    if (currency === "USD" && !tradeExchangeRate) {
      return {
        isValid: false,
        quantity: nextQuantity,
        averagePurchasePrice: nextAveragePurchasePrice,
        purchaseExchangeRate
      };
    }

    if (currency === "USD" && tradeExchangeRate) {
      const currentExchangeRate = purchaseExchangeRate ?? tradeExchangeRate;
      nextPurchaseExchangeRate =
        (currentNativeCost * currentExchangeRate + tradeNativeCost * tradeExchangeRate) /
        (currentNativeCost + tradeNativeCost);
    }

    return {
      isValid: true,
      quantity: nextQuantity,
      averagePurchasePrice: nextAveragePurchasePrice,
      purchaseExchangeRate: nextPurchaseExchangeRate
    };
  }, [
    averagePurchasePrice,
    currency,
    lastPrice,
    purchaseExchangeRate,
    quantity,
    tradeForm.exchangeRate,
    tradeForm.orderPrice,
    tradeForm.quantity,
    tradeForm.side
  ]);

  function clearSearchFailure() {
    if (searchFailureTimeoutRef.current) {
      window.clearTimeout(searchFailureTimeoutRef.current);
      searchFailureTimeoutRef.current = null;
    }
    setSearchFailed(false);
  }

  function showSearchFailure() {
    if (searchFailureTimeoutRef.current) {
      window.clearTimeout(searchFailureTimeoutRef.current);
    }
    setSearchFailed(false);
    window.requestAnimationFrame(() => {
      setSearchFailed(true);
      searchFailureTimeoutRef.current = window.setTimeout(() => {
        setSearchFailed(false);
        searchFailureTimeoutRef.current = null;
      }, 520);
    });
  }

  useEffect(() => {
    return () => {
      if (searchFailureTimeoutRef.current) {
        window.clearTimeout(searchFailureTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setResults([]);
      setIsSearching(false);
      clearSearchFailure();
      return;
    }

    const keyword = query.trim();
    if (!keyword) {
      setResults([]);
      setIsSearching(false);
      clearSearchFailure();
      return;
    }

    clearSearchFailure();
    const controller = new AbortController();
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      const requestTimeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`/api/market/search?q=${encodeURIComponent(keyword)}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          setResults([]);
          if (!cancelled) showSearchFailure();
          return;
        }

        const json = (await response.json()) as { results?: SearchResult[] };
        const nextResults = json.results ?? [];
        setResults(nextResults);
        if (nextResults.length === 0 && !cancelled) {
          showSearchFailure();
        }
      } catch (error) {
        if (!cancelled || !isAbortError(error)) {
          setResults([]);
          showSearchFailure();
        }
      } finally {
        window.clearTimeout(requestTimeout);
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [isOpen, query]);

  function closeModal() {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setIsSearching(false);
    clearSearchFailure();
    setForm(initialForm);
    setTradeForm(initialTradeForm);
  }

  if (!symbol && !isOpen) {
    return (
      <button className="secondary" type="button" onClick={() => setIsOpen(true)}>
        종목 추가
      </button>
    );
  }

  if (symbol && !isOpen) {
    const stock = { symbol, name, alias, marketCountry, currency };
    const secondaryLabel = stockSecondaryLabel(stock);

    return (
      <div className="holding-summary">
        <div>
          <strong>{stockPrimaryLabel(stock)}</strong>
          <RiskBadge level={riskLevel} showUnassigned />
          {secondaryLabel ? <span>{secondaryLabel}</span> : null}
          <em>
            {formatHoldingNumber(quantity)}주 · 현재가 {formatHoldingCurrency(lastPrice, currency, 6)} · 평단{" "}
            {formatHoldingCurrency(averagePurchasePrice, currency, 6)}
          </em>
        </div>
        <button className="secondary" type="button" onClick={() => setIsOpen(true)}>
          수정
        </button>
      </div>
    );
  }

  async function selectResult(result: SearchResult) {
    let next = result;

    try {
      const response = await fetch(`/api/market/quote?symbol=${encodeURIComponent(result.symbol)}`);
      if (response.ok) {
        const json = (await response.json()) as { quote?: SearchResult | null };
        next = json.quote ?? result;
      }
    } catch {
      next = result;
    }

    setForm((current) => ({
      ...current,
      symbol: next.symbol,
      name: next.name,
      marketCountry: next.marketCountry ?? current.marketCountry,
      currency: next.currency ?? (next.marketCountry ? currencyFromMarket(next.marketCountry) : current.currency),
      lastPrice: next.lastPrice ? String(next.lastPrice) : current.lastPrice
    }));
    setQuery("");
    setResults([]);
    clearSearchFailure();
  }

  const modalTitle = symbol ? "운영 종목 수정" : "운영 종목 추가";
  const submitLabel = symbol ? "변경 저장" : "종목 추가";

  return (
    <div className="holding-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeModal();
    }}>
      <section aria-modal="true" className="holding-modal" role="dialog" aria-labelledby={`holding-modal-title-${symbol ?? "new"}`}>
        <header className="holding-modal-header">
          <div>
            <h3 id={`holding-modal-title-${symbol ?? "new"}`}>{modalTitle}</h3>
            <p>{symbol ? stockPrimaryLabel({ symbol, name, alias, marketCountry, currency }) : "검색 결과를 선택하면 기본 정보가 채워집니다."}</p>
          </div>
          <button aria-label="닫기" className="ghost holding-modal-close" type="button" onClick={closeModal}>
            <X size={18} />
          </button>
        </header>

        <ApiMutationForm
          action="/api/admin/portfolio/holding"
          className="form compact holding-form holding-modal-form"
          method="post"
          onSuccess={closeModal}
        >
          <div className="symbol-search">
            <Field htmlFor={`search-${symbol ?? "new"}`} label="종목 검색">
              <div className="search-control">
                <input
                  className={searchFailed ? "search-input-failed" : undefined}
                  autoComplete="off"
                  id={`search-${symbol ?? "new"}`}
                  value={query}
                  placeholder="종목명 또는 심볼"
                  onChange={(event) => {
                    clearSearchFailure();
                    setQuery(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                    }
                    if (event.key === "Escape") {
                      closeModal();
                    }
                  }}
                />
                {isSearching ? <span className="search-status">검색 중</span> : null}
                {!isSearching && searchFailed ? <span className="search-status failed">검색 실패</span> : null}
              </div>
            </Field>
            {results.length > 0 ? (
              <div className="search-results">
                {results.map((result) => (
                  <button
                    className="search-result"
                    key={`${result.source}-${result.symbol}`}
                    type="button"
                    onClick={() => void selectResult(result)}
                  >
                    <strong>{stockPrimaryLabel(result)}</strong>
                    {stockSecondaryLabel(result) ? <span>{stockSecondaryLabel(result)}</span> : null}
                    <em>{[marketLabel(result.marketCountry), result.exchange, result.currency].filter(Boolean).join(" · ")}</em>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="holding-modal-grid">
            <Field htmlFor={`symbol-${symbol ?? "new"}`} label="심볼">
              <input
                id={`symbol-${symbol ?? "new"}`}
                name="symbol"
                value={form.symbol}
                onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))}
                required
              />
            </Field>
            <Field htmlFor={`name-${symbol ?? "new"}`} label="종목명" wide>
              <input
                id={`name-${symbol ?? "new"}`}
                name="name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </Field>
            <Field htmlFor={`alias-${symbol ?? "new"}`} label="표시 별칭" wide>
              <input
                id={`alias-${symbol ?? "new"}`}
                name="alias"
                value={form.alias}
                placeholder="비워두면 종목명/심볼 기준으로 표시"
                onChange={(event) => setForm((current) => ({ ...current, alias: event.target.value }))}
              />
            </Field>
            <Field htmlFor={`risk-level-${symbol ?? "new"}`} label="위험도" wide>
              <TdsSelect
                id={`risk-level-${symbol ?? "new"}`}
                name="riskLevel"
                value={form.riskLevel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    riskLevel: event.target.value as HoldingFormState["riskLevel"]
                  }))
                }
              >
                <option value="">미지정</option>
                <option value="LOW">저위험</option>
                <option value="HIGH">고위험</option>
              </TdsSelect>
            </Field>
            <Field htmlFor={`market-${symbol ?? "new"}`} label="시장">
              <TdsSelect
                id={`market-${symbol ?? "new"}`}
                name="marketCountry"
                value={form.marketCountry}
                onChange={(event) => {
                  const marketCountry = event.target.value as MarketCode;
                  setForm((current) => ({
                    ...current,
                    marketCountry,
                    currency: currencyFromMarket(marketCountry)
                  }));
                }}
              >
                <option value="NASDAQ">나스닥</option>
                <option value="NYSE">뉴욕증권거래소</option>
                <option value="AMEX">아메리칸증권거래소</option>
                <option value="KOSPI">유가증권시장</option>
                <option value="KOSDAQ">코스닥시장</option>
              </TdsSelect>
            </Field>
            <Field htmlFor={`currency-${symbol ?? "new"}`} label="통화">
              <TdsSelect
                id={`currency-${symbol ?? "new"}`}
                name="currency"
                value={form.currency}
                onChange={(event) =>
                  setForm((current) => ({ ...current, currency: event.target.value as "KRW" | "USD" }))
                }
              >
                <option value="USD">USD</option>
                <option value="KRW">KRW</option>
              </TdsSelect>
            </Field>
            <Field htmlFor={`quantity-${symbol ?? "new"}`} label={symbol ? "수량(체결 원장 전용)" : "초기 수량(0으로 등록)"}>
              <input
                id={`quantity-${symbol ?? "new"}`}
                name="quantity"
                type="number"
                step="0.000001"
                min="0"
                value={form.quantity}
                disabled={Boolean(symbol)}
                onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                required
              />
            </Field>
            <Field htmlFor={`price-${symbol ?? "new"}`} label={`현재가 (${currencySymbol(form.currency)})`}>
              <FormattedNumberInput
                allowDecimal
                id={`price-${symbol ?? "new"}`}
                name="lastPrice"
                step="0.000001"
                min="0"
                value={form.lastPrice}
                onValueChange={(value) => setForm((current) => ({ ...current, lastPrice: value }))}
                required
              />
            </Field>
            <Field htmlFor={`avg-${symbol ?? "new"}`} label={`평단(체결 원장 전용, ${currencySymbol(form.currency)})`}>
              <FormattedNumberInput
                allowDecimal
                id={`avg-${symbol ?? "new"}`}
                name="averagePurchasePrice"
                step="0.000001"
                min="0"
                value={form.averagePurchasePrice}
                disabled={Boolean(symbol)}
                onValueChange={(value) => setForm((current) => ({ ...current, averagePurchasePrice: value }))}
                required
              />
            </Field>
            <Field htmlFor={`purchase-fx-${symbol ?? "new"}`} label="매입환율 (₩)">
              <FormattedNumberInput
                allowDecimal
                id={`purchase-fx-${symbol ?? "new"}`}
                name="purchaseExchangeRate"
                step="0.01"
                min="500"
                max="3000"
                value={form.purchaseExchangeRate}
                disabled={form.currency !== "USD" || Boolean(symbol)}
                onValueChange={(value) => setForm((current) => ({ ...current, purchaseExchangeRate: value }))}
                required={form.currency === "USD"}
              />
            </Field>
          </div>

          {symbol ? (
            <section className="holding-trade-panel" aria-labelledby={`holding-trade-title-${symbol}`}>
              <input name="tradeSymbol" type="hidden" value={symbol} />
              <header>
                <h4 id={`holding-trade-title-${symbol}`}>거래 적용</h4>
                <div className="trade-side-toggle" role="radiogroup" aria-label="거래 구분">
                  {(["BUY", "SELL"] as TradeSide[]).map((side) => (
                    <label className={tradeForm.side === side ? "selected" : undefined} key={side}>
                      <input
                        checked={tradeForm.side === side}
                        name="side"
                        type="radio"
                        value={side}
                        onChange={() => setTradeForm((current) => ({ ...current, side }))}
                      />
                      <span>{side === "BUY" ? "매수" : "매도"}</span>
                    </label>
                  ))}
                </div>
              </header>
              <div className="holding-trade-grid">
                <Field htmlFor={`trade-quantity-${symbol}`} label="거래 수량">
                  <FormattedNumberInput
                    allowDecimal
                    id={`trade-quantity-${symbol}`}
                    name="tradeQuantity"
                    step="0.000001"
                    min="0"
                    placeholder="예: 3"
                    value={tradeForm.quantity}
                    onValueChange={(value) => setTradeForm((current) => ({ ...current, quantity: value }))}
                  />
                </Field>
                <Field htmlFor={`trade-price-${symbol}`} label={`거래가 (${currencySymbol(currency ?? "USD")})`}>
                  <FormattedNumberInput
                    allowDecimal
                    id={`trade-price-${symbol}`}
                    name="orderPrice"
                    step="0.000001"
                    min="0"
                    placeholder={currency === "USD" ? "예: 78.5" : "예: 12,000"}
                    value={tradeForm.orderPrice}
                    onValueChange={(value) => setTradeForm((current) => ({ ...current, orderPrice: value }))}
                  />
                </Field>
                <Field htmlFor={`trade-fx-${symbol}`} label="거래환율 (₩)">
                  <FormattedNumberInput
                    allowDecimal
                    id={`trade-fx-${symbol}`}
                    name="exchangeRate"
                    step="0.01"
                    min="500"
                    max="3000"
                    placeholder={currency === "USD" ? "증권사 실제 체결환율" : "원화 거래는 입력하지 않음"}
                    value={tradeForm.exchangeRate}
                    disabled={currency !== "USD"}
                    onValueChange={(value) => setTradeForm((current) => ({ ...current, exchangeRate: value }))}
                    required={currency === "USD"}
                  />
                </Field>
                <Field htmlFor={`trade-fee-${symbol}`} label="거래 수수료 (₩)">
                  <FormattedNumberInput
                    id={`trade-fee-${symbol}`}
                    name="feeKrw"
                    min="0"
                    defaultValue="0"
                  />
                </Field>
                <Field htmlFor={`trade-tax-${symbol}`} label="거래 세금 (₩)">
                  <FormattedNumberInput
                    id={`trade-tax-${symbol}`}
                    name="taxKrw"
                    min="0"
                    defaultValue="0"
                  />
                </Field>
                <Field htmlFor={`trade-executed-at-${symbol}`} label="실제 체결시각 (KST)">
                  <input
                    id={`trade-executed-at-${symbol}`}
                    name="executedAt"
                    type="datetime-local"
                    defaultValue={currentKstDateTimeLocal()}
                    required
                  />
                </Field>
              </div>
              <div className="holding-trade-result">
                <ComputedValue
                  label="적용 후 수량"
                  value={
                    tradePreview.isValid
                      ? `${formatHoldingNumber(tradePreview.quantity)}주`
                      : tradeForm.side === "SELL"
                        ? "수량 부족"
                        : "-"
                  }
                />
                <ComputedValue
                  label="적용 후 평단"
                  value={formatHoldingCurrency(tradePreview.averagePurchasePrice, currency, 6)}
                />
                {currency === "USD" ? (
                  <ComputedValue
                    label="적용 후 환율"
                    value={formatHoldingCurrency(tradePreview.purchaseExchangeRate, "KRW", 2)}
                  />
                ) : null}
                <button
                  className="secondary"
                  disabled={!tradePreview.isValid}
                  formAction="/api/admin/portfolio/trade"
                  formMethod="post"
                  type="submit"
                >
                  거래 적용
                </button>
              </div>
            </section>
          ) : null}

          <footer className="holding-modal-actions">
            <ComputedValue label="손익률" value={computedRate === null ? "-" : `${computedRate.toFixed(2)}%`} />
            <div className="holding-modal-buttons">
              {symbol ? (
                <button
                  className="ghost"
                  formAction="/api/admin/portfolio/delete"
                  formMethod="post"
                  formNoValidate
                  name="symbol"
                  type="submit"
                  value={symbol}
                >
                  삭제
                </button>
              ) : null}
              <button className="secondary" type="button" onClick={closeModal}>
                취소
              </button>
              <button type="submit">{submitLabel}</button>
            </div>
          </footer>
        </ApiMutationForm>
      </section>
    </div>
  );
}
