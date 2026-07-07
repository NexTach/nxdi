"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Field, Form } from "@/app/components/tds";
import { currencySymbol } from "@/lib/format";
import { stockPrimaryLabel, stockSecondaryLabel } from "@/lib/stock-display";
import type { Disclosure, MarketCode, TradeSide } from "@/lib/types";

type SearchResult = {
  symbol: string;
  name: string;
  exchange?: string;
  currency?: "KRW" | "USD";
  marketCountry?: MarketCode;
  lastPrice?: number;
  source: string;
};

type TradeFormState = {
  clientId: string;
  side: TradeSide;
  symbol: string;
  name: string;
  alias: string;
  marketCountry: MarketCode;
  currency: "KRW" | "USD";
  quantity: string;
  orderPrice: string;
  exchangeRate: string;
  profitRate: string;
  feeKrw: string;
  taxKrw: string;
  orderedAt: string;
};

function createClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function currencyFromMarket(market: MarketCode): "KRW" | "USD" {
  return market === "KOSPI" || market === "KOSDAQ" ? "KRW" : "USD";
}

function normalizeMarketCode(value?: string, currency?: "KRW" | "USD", symbol?: string): MarketCode {
  if (value === "NASDAQ" || value === "NYSE" || value === "AMEX" || value === "KOSPI" || value === "KOSDAQ") {
    return value;
  }
  if (currency === "KRW") return symbol?.toUpperCase().endsWith(".KQ") ? "KOSDAQ" : "KOSPI";
  return "NASDAQ";
}

function marketLabel(market?: MarketCode) {
  if (market === "NYSE") return "뉴욕증권거래소";
  if (market === "AMEX") return "아메리칸증권거래소";
  if (market === "KOSPI") return "유가증권시장";
  if (market === "KOSDAQ") return "코스닥시장";
  return "나스닥";
}

function toDateTimeLocal(value?: string) {
  const date = value ? new Date(value) : new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function createEmptyTrade(): TradeFormState {
  return {
    clientId: createClientId(),
    side: "BUY",
    symbol: "",
    name: "",
    alias: "",
    marketCountry: "NASDAQ",
    currency: "USD",
    quantity: "",
    orderPrice: "",
    exchangeRate: "",
    profitRate: "0",
    feeKrw: "0",
    taxKrw: "0",
    orderedAt: toDateTimeLocal()
  };
}

function createTradeState(disclosure: Disclosure | undefined): TradeFormState[] {
  if (!disclosure || disclosure.trades.length === 0) return [];

  return disclosure.trades.map((trade) => ({
    clientId: trade.id,
    side: trade.side,
    symbol: trade.symbol,
    name: trade.name,
    alias: trade.alias ?? "",
    marketCountry: trade.marketCountry,
    currency: trade.currency,
    quantity: String(trade.quantity),
    orderPrice: String(trade.orderPrice),
    exchangeRate: trade.exchangeRate ? String(trade.exchangeRate) : "",
    profitRate: String(Number((trade.profitRate * 100).toFixed(4))),
    feeKrw: String(trade.feeKrw),
    taxKrw: String(trade.taxKrw),
    orderedAt: toDateTimeLocal(trade.orderedAt)
  }));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function TradeEditor({
  trade,
  index,
  onChange,
  onRemove
}: {
  trade: TradeFormState;
  index: number;
  onChange: (trade: TradeFormState) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const searchFailureTimeoutRef = useRef<number | null>(null);

  function update(patch: Partial<TradeFormState>) {
    onChange({ ...trade, ...patch });
  }

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
      if (searchFailureTimeoutRef.current) window.clearTimeout(searchFailureTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
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
        if (nextResults.length === 0 && !cancelled) showSearchFailure();
      } catch (error) {
        if (!cancelled || !isAbortError(error)) {
          setResults([]);
          showSearchFailure();
        }
      } finally {
        window.clearTimeout(requestTimeout);
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

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

    const marketCountry = normalizeMarketCode(next.marketCountry, next.currency, next.symbol);
    const currency = next.currency ?? currencyFromMarket(marketCountry);
    update({
      symbol: next.symbol,
      name: next.name,
      marketCountry,
      currency,
      orderPrice: next.lastPrice ? String(next.lastPrice) : trade.orderPrice,
      exchangeRate: currency === "KRW" ? "" : trade.exchangeRate
    });
    setQuery("");
    setResults([]);
    clearSearchFailure();
  }

  return (
    <section className="trade-editor-card">
      <header className="trade-editor-header">
        <strong>거래 이력 {index + 1}</strong>
        <button aria-label="거래 이력 삭제" className="ghost" type="button" onClick={onRemove}>
          <Trash2 size={16} />
        </button>
      </header>

      <div className="symbol-search">
        <Field htmlFor={`disclosure-search-${trade.clientId}`} label="종목 검색">
          <div className="search-control">
            <input
              autoComplete="off"
              className={searchFailed ? "search-input-failed" : undefined}
              id={`disclosure-search-${trade.clientId}`}
              placeholder="종목명 또는 심볼"
              value={query}
              onChange={(event) => {
                clearSearchFailure();
                setQuery(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
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

      <div className="disclosure-trade-form-grid">
        <Field htmlFor={`side-${trade.clientId}`} label="구분">
          <select
            id={`side-${trade.clientId}`}
            value={trade.side}
            onChange={(event) => update({ side: event.target.value as TradeSide })}
          >
            <option value="BUY">매수</option>
            <option value="SELL">매도</option>
          </select>
        </Field>
        <Field htmlFor={`symbol-${trade.clientId}`} label="심볼">
          <input
            id={`symbol-${trade.clientId}`}
            placeholder="예: SCHD"
            required
            value={trade.symbol}
            onChange={(event) => update({ symbol: event.target.value })}
          />
        </Field>
        <Field htmlFor={`name-${trade.clientId}`} label="종목명" wide>
          <input
            id={`name-${trade.clientId}`}
            placeholder="예: Schwab US Dividend Equity ETF"
            required
            value={trade.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </Field>
        <Field htmlFor={`alias-${trade.clientId}`} label="표시 별칭" wide>
          <input
            id={`alias-${trade.clientId}`}
            placeholder="비워두면 종목명/심볼 기준으로 표시"
            value={trade.alias}
            onChange={(event) => update({ alias: event.target.value })}
          />
        </Field>
        <Field htmlFor={`market-${trade.clientId}`} label="시장">
          <select
            id={`market-${trade.clientId}`}
            value={trade.marketCountry}
            onChange={(event) => {
              const marketCountry = event.target.value as MarketCode;
              const currency = currencyFromMarket(marketCountry);
              update({
                marketCountry,
                currency,
                exchangeRate: currency === "KRW" ? "" : trade.exchangeRate
              });
            }}
          >
            <option value="NASDAQ">나스닥</option>
            <option value="NYSE">뉴욕증권거래소</option>
            <option value="AMEX">아메리칸증권거래소</option>
            <option value="KOSPI">유가증권시장</option>
            <option value="KOSDAQ">코스닥시장</option>
          </select>
        </Field>
        <Field htmlFor={`currency-${trade.clientId}`} label="통화">
          <select
            id={`currency-${trade.clientId}`}
            value={trade.currency}
            onChange={(event) => update({ currency: event.target.value as "KRW" | "USD" })}
          >
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
          </select>
        </Field>
        <Field htmlFor={`quantity-${trade.clientId}`} label="수량">
          <input
            id={`quantity-${trade.clientId}`}
            min="0"
            placeholder="예: 3"
            required
            step="0.000001"
            type="number"
            value={trade.quantity}
            onChange={(event) => update({ quantity: event.target.value })}
          />
        </Field>
        <Field htmlFor={`price-${trade.clientId}`} label={`체결가 (${currencySymbol(trade.currency)})`}>
          <input
            id={`price-${trade.clientId}`}
            min="0"
            placeholder={trade.currency === "USD" ? "예: 78.5" : "예: 12000"}
            required
            step="0.000001"
            type="number"
            value={trade.orderPrice}
            onChange={(event) => update({ orderPrice: event.target.value })}
          />
        </Field>
        <Field htmlFor={`exchange-${trade.clientId}`} label="기준환율 (₩)">
          <input
            disabled={trade.currency !== "USD"}
            id={`exchange-${trade.clientId}`}
            max="3000"
            min="500"
            placeholder={trade.currency === "USD" ? "예: 1380.5" : "원화 거래는 입력하지 않음"}
            required={trade.currency === "USD"}
            step="0.01"
            type="number"
            value={trade.exchangeRate}
            onChange={(event) => update({ exchangeRate: event.target.value })}
          />
        </Field>
        <Field htmlFor={`profit-${trade.clientId}`} label="수익률 (%)">
          <input
            id={`profit-${trade.clientId}`}
            placeholder="예: 4.25"
            required
            step="0.0001"
            type="number"
            value={trade.profitRate}
            onChange={(event) => update({ profitRate: event.target.value })}
          />
        </Field>
        <Field htmlFor={`fee-${trade.clientId}`} label="수수료 (₩)">
          <input
            id={`fee-${trade.clientId}`}
            min="0"
            placeholder="예: 1200"
            required
            step="1"
            type="number"
            value={trade.feeKrw}
            onChange={(event) => update({ feeKrw: event.target.value })}
          />
        </Field>
        <Field htmlFor={`tax-${trade.clientId}`} label="세금 (₩)">
          <input
            id={`tax-${trade.clientId}`}
            min="0"
            placeholder="예: 0"
            required
            step="1"
            type="number"
            value={trade.taxKrw}
            onChange={(event) => update({ taxKrw: event.target.value })}
          />
        </Field>
        <Field htmlFor={`ordered-at-${trade.clientId}`} label="주문 일시" wide>
          <input
            id={`ordered-at-${trade.clientId}`}
            required
            type="datetime-local"
            value={trade.orderedAt}
            onChange={(event) => update({ orderedAt: event.target.value })}
          />
        </Field>
      </div>
    </section>
  );
}

export function DisclosureForm({ disclosure }: { disclosure?: Disclosure }) {
  const [isOpen, setIsOpen] = useState(false);
  const initialTrades = useMemo(() => createTradeState(disclosure), [disclosure]);
  const [trades, setTrades] = useState<TradeFormState[]>(initialTrades);
  const modalTitle = disclosure ? "공시 수정" : "공시 작성";
  const buttonLabel = disclosure ? "수정" : "공시 작성";
  const tradesJson = JSON.stringify(
    trades.map((trade) => ({
      side: trade.side,
      symbol: trade.symbol,
      name: trade.name,
      alias: trade.alias,
      marketCountry: trade.marketCountry,
      currency: trade.currency,
      quantity: trade.quantity,
      orderPrice: trade.orderPrice,
      exchangeRate: trade.exchangeRate,
      profitRate: trade.profitRate,
      feeKrw: trade.feeKrw,
      taxKrw: trade.taxKrw,
      orderedAt: trade.orderedAt
    }))
  );

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isOpen]);

  function closeModal() {
    setTrades(initialTrades);
    setIsOpen(false);
  }

  function updateTrade(index: number, trade: TradeFormState) {
    setTrades((current) => current.map((item, itemIndex) => (itemIndex === index ? trade : item)));
  }

  function removeTrade(index: number) {
    setTrades((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <>
      <button className={disclosure ? "secondary" : undefined} type="button" onClick={() => setIsOpen(true)}>
        {buttonLabel}
      </button>

      {isOpen ? (
        <div
          className="holding-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section aria-labelledby={`disclosure-modal-${disclosure?.id ?? "new"}`} aria-modal="true" className="holding-modal disclosure-modal" role="dialog">
            <header className="holding-modal-header">
              <div>
                <h3 id={`disclosure-modal-${disclosure?.id ?? "new"}`}>{modalTitle}</h3>
                <p>제목과 본문을 입력하고 필요한 경우 매수·매도 이력을 첨부합니다.</p>
              </div>
              <button aria-label="닫기" className="ghost holding-modal-close" type="button" onClick={closeModal}>
                <X size={18} />
              </button>
            </header>

            <Form action="/api/admin/disclosures" className="holding-modal-form" method="post">
              <input name="id" type="hidden" value={disclosure?.id ?? ""} />
              <input name="tradesJson" type="hidden" value={tradesJson} />
              <div className="disclosure-form-grid">
                <Field htmlFor={`disclosure-title-${disclosure?.id ?? "new"}`} label="제목" wide>
                  <input
                    defaultValue={disclosure?.title ?? ""}
                    id={`disclosure-title-${disclosure?.id ?? "new"}`}
                    maxLength={160}
                    name="title"
                    required
                  />
                </Field>
                <Field htmlFor={`disclosure-body-${disclosure?.id ?? "new"}`} label="본문" wide>
                  <textarea
                    defaultValue={disclosure?.body ?? ""}
                    id={`disclosure-body-${disclosure?.id ?? "new"}`}
                    name="body"
                    required
                    rows={8}
                  />
                </Field>
              </div>

              <div className="trade-editor-list">
                <div className="trade-editor-list-header">
                  <strong>첨부 거래 이력</strong>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setTrades((current) => [...current, createEmptyTrade()])}
                  >
                    <Plus size={16} /> 거래 추가
                  </button>
                </div>
                {trades.map((trade, index) => (
                  <TradeEditor
                    index={index}
                    key={trade.clientId}
                    trade={trade}
                    onChange={(nextTrade) => updateTrade(index, nextTrade)}
                    onRemove={() => removeTrade(index)}
                  />
                ))}
                {trades.length === 0 ? <p className="field-help">첨부된 거래 이력이 없습니다.</p> : null}
              </div>

              <footer className="holding-modal-actions disclosure-modal-actions">
                <span className="field-help">공시는 저장 즉시 사용자에게 노출됩니다.</span>
                <div className="holding-modal-buttons">
                  <button className="secondary" type="button" onClick={closeModal}>
                    취소
                  </button>
                  <button type="submit">{disclosure ? "변경 저장" : "공시 등록"}</button>
                </div>
              </footer>
            </Form>
          </section>
        </div>
      ) : null}
    </>
  );
}
