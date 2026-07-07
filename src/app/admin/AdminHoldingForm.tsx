"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ComputedValue, Field, Form, InlineFields } from "@/app/components/tds";
import type { Holding } from "@/lib/types";

type SearchResult = {
  symbol: string;
  name: string;
  exchange?: string;
  currency?: "KRW" | "USD";
  marketCountry?: "KR" | "US";
  lastPrice?: number;
  source: string;
};

type AdminHoldingFormProps = Partial<Pick<
  Holding,
  | "symbol"
  | "name"
  | "marketCountry"
  | "currency"
  | "quantity"
  | "lastPrice"
  | "averagePurchasePrice"
  | "purchaseExchangeRate"
>>;

function profitLossRate(lastPrice?: number, averagePurchasePrice?: number) {
  if (!lastPrice || !averagePurchasePrice) return null;
  return ((lastPrice - averagePurchasePrice) / averagePurchasePrice) * 100;
}

export function AdminHoldingForm({
  symbol,
  name,
  marketCountry,
  currency,
  quantity,
  lastPrice,
  averagePurchasePrice,
  purchaseExchangeRate
}: AdminHoldingFormProps) {
  const [isOpen, setIsOpen] = useState(Boolean(symbol));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [form, setForm] = useState({
    symbol: symbol ?? "",
    name: name ?? "",
    marketCountry: marketCountry ?? "US",
    currency: currency ?? "USD",
    quantity: quantity?.toString() ?? "",
    lastPrice: lastPrice?.toString() ?? "",
    averagePurchasePrice: averagePurchasePrice?.toString() ?? "",
    purchaseExchangeRate: purchaseExchangeRate?.toString() ?? ""
  });

  const computedRate = useMemo(
    () => profitLossRate(Number(form.lastPrice), Number(form.averagePurchasePrice)),
    [form.averagePurchasePrice, form.lastPrice]
  );

  if (!symbol && !isOpen) {
    return (
      <button className="secondary" type="button" onClick={() => setIsOpen(true)}>
        종목 추가
      </button>
    );
  }

  async function search() {
    const keyword = query.trim();
    if (!keyword) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/market/search?q=${encodeURIComponent(keyword)}`);
      const json = (await response.json()) as { results?: SearchResult[] };
      setResults(json.results ?? []);
    } finally {
      setIsSearching(false);
    }
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
      currency: next.currency ?? current.currency,
      lastPrice: next.lastPrice ? String(next.lastPrice) : current.lastPrice
    }));
    setQuery("");
    setResults([]);
  }

  return (
    <Form action="/api/admin/portfolio/holding" className="holding-form" compact method="post">
      <div className="symbol-search">
        <Field htmlFor={`search-${symbol ?? "new"}`} label="종목 검색">
          <div className="search-control">
            <input
              id={`search-${symbol ?? "new"}`}
              value={query}
              placeholder="종목명 또는 심볼"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void search();
                }
              }}
            />
            <button className="secondary" type="button" onClick={() => void search()}>
              <Search size={16} />
              {isSearching ? "검색 중" : "검색"}
            </button>
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
                <strong>{result.symbol}</strong>
                <span>{result.name}</span>
                <em>{[result.exchange, result.currency].filter(Boolean).join(" · ")}</em>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <InlineFields variant="holding">
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
        <Field htmlFor={`market-${symbol ?? "new"}`} label="시장">
          <select
            id={`market-${symbol ?? "new"}`}
            name="marketCountry"
            value={form.marketCountry}
            onChange={(event) =>
              setForm((current) => ({ ...current, marketCountry: event.target.value as "KR" | "US" }))
            }
          >
            <option value="US">미국</option>
            <option value="KR">국내</option>
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
        <Field htmlFor={`price-${symbol ?? "new"}`} label="현재가">
          <input
            id={`price-${symbol ?? "new"}`}
            name="lastPrice"
            type="number"
            step="0.000001"
            min="0"
            value={form.lastPrice}
            onChange={(event) => setForm((current) => ({ ...current, lastPrice: event.target.value }))}
            required
          />
        </Field>
        <Field htmlFor={`avg-${symbol ?? "new"}`} label="평단">
          <input
            id={`avg-${symbol ?? "new"}`}
            name="averagePurchasePrice"
            type="number"
            step="0.000001"
            min="0"
            value={form.averagePurchasePrice}
            onChange={(event) =>
              setForm((current) => ({ ...current, averagePurchasePrice: event.target.value }))
            }
          />
        </Field>
        <Field htmlFor={`purchase-fx-${symbol ?? "new"}`} label="매입환율">
          <input
            id={`purchase-fx-${symbol ?? "new"}`}
            name="purchaseExchangeRate"
            type="number"
            step="0.01"
            min="500"
            max="3000"
            value={form.purchaseExchangeRate}
            disabled={form.currency !== "USD"}
            onChange={(event) =>
              setForm((current) => ({ ...current, purchaseExchangeRate: event.target.value }))
            }
          />
        </Field>
        <ComputedValue label="손익률" value={computedRate === null ? "-" : `${computedRate.toFixed(2)}%`} />
        <button type="submit">{symbol ? "수정" : "추가"}</button>
        {!symbol ? (
          <button className="ghost" type="button" onClick={() => setIsOpen(false)}>
            취소
          </button>
        ) : null}
      </InlineFields>
    </Form>
  );
}
