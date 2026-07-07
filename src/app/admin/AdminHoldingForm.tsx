"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import { ComputedValue, Field, Form } from "@/app/components/tds";
import { currencySymbol, formatCurrency } from "@/lib/format";
import { stockPrimaryLabel, stockSecondaryLabel } from "@/lib/stock-display";
import type { Holding, MarketCode } from "@/lib/types";

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
};

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
  purchaseExchangeRate
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
    purchaseExchangeRate: purchaseExchangeRate?.toString() ?? ""
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
  purchaseExchangeRate
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
        purchaseExchangeRate
      }),
    [alias, averagePurchasePrice, currency, lastPrice, marketCountry, name, purchaseExchangeRate, quantity, symbol]
  );
  const [form, setForm] = useState<HoldingFormState>(initialForm);

  const computedRate = useMemo(
    () => profitLossRate(Number(form.lastPrice), Number(form.averagePurchasePrice)),
    [form.averagePurchasePrice, form.lastPrice]
  );

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

        <Form action="/api/admin/portfolio/holding" className="holding-form holding-modal-form" compact method="post">
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
            <Field htmlFor={`market-${symbol ?? "new"}`} label="시장">
              <select
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
              </select>
            </Field>
            <Field htmlFor={`currency-${symbol ?? "new"}`} label="통화">
              <select
                id={`currency-${symbol ?? "new"}`}
                name="currency"
                value={form.currency}
                onChange={(event) =>
                  setForm((current) => ({ ...current, currency: event.target.value as "KRW" | "USD" }))
                }
              >
                <option value="USD">USD</option>
                <option value="KRW">KRW</option>
              </select>
            </Field>
            <Field htmlFor={`quantity-${symbol ?? "new"}`} label="수량">
              <input
                id={`quantity-${symbol ?? "new"}`}
                name="quantity"
                type="number"
                step="0.000001"
                min="0"
                value={form.quantity}
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
            <Field htmlFor={`avg-${symbol ?? "new"}`} label={`평단 (${currencySymbol(form.currency)})`}>
              <FormattedNumberInput
                allowDecimal
                id={`avg-${symbol ?? "new"}`}
                name="averagePurchasePrice"
                step="0.000001"
                min="0"
                value={form.averagePurchasePrice}
                onValueChange={(value) => setForm((current) => ({ ...current, averagePurchasePrice: value }))}
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
                disabled={form.currency !== "USD"}
                onValueChange={(value) => setForm((current) => ({ ...current, purchaseExchangeRate: value }))}
              />
            </Field>
          </div>

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
        </Form>
      </section>
    </div>
  );
}
