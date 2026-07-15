"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent
} from "react";
import { createPortal } from "react-dom";
import { ApiMutationForm } from "@/app/components/api-mutation-form";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import { Field, TdsSelect } from "@/app/components/tds";
import { exactPortfolioHolding, searchPortfolioHoldings } from "@/lib/holding-search";
import { stockFullLabel } from "@/lib/stock-display";
import type { Holding } from "@/lib/types";

function currentKstDateTimeLocal() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

type SearchableHolding = Pick<Holding, "alias" | "currency" | "marketCountry" | "name" | "symbol">;
type ListboxPosition = Pick<CSSProperties, "left" | "maxHeight" | "top" | "transform" | "width">;

function HoldingCombobox({ holdings }: { holdings: readonly SearchableHolding[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [listboxPosition, setListboxPosition] = useState<ListboxPosition>();
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const matches = useMemo(() => searchPortfolioHoldings(holdings, query), [holdings, query]);

  function positionListbox(input: HTMLInputElement) {
    const rect = input.getBoundingClientRect();
    const gap = 6;
    const viewportPadding = 16;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const openAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
    const availableHeight = openAbove ? spaceAbove : spaceBelow;

    setListboxPosition({
      left: rect.left,
      maxHeight: Math.max(120, Math.min(240, availableHeight)),
      top: openAbove ? rect.top - gap : rect.bottom + gap,
      transform: openAbove ? "translateY(-100%)" : undefined,
      width: rect.width
    });
  }

  function showListbox(input: HTMLInputElement) {
    positionListbox(input);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (inputRef.current) positionListbox(inputRef.current);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  function updateValidity(input: HTMLInputElement, value: string) {
    input.setCustomValidity(
      !value || exactPortfolioHolding(holdings, value)
        ? ""
        : "현재 운용 중인 포트폴리오 종목을 목록에서 선택해 주세요."
    );
  }

  function changeQuery(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.currentTarget.value);
    setActiveIndex(0);
    showListbox(event.currentTarget);
    updateValidity(event.currentTarget, event.currentTarget.value);
  }

  function selectHolding(holding: SearchableHolding) {
    setQuery(holding.symbol);
    setOpen(false);
    inputRef.current?.setCustomValidity("");
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (inputRef.current) showListbox(inputRef.current);
      setActiveIndex((current) => {
        if (matches.length === 0) return 0;
        return event.key === "ArrowDown"
          ? (current + 1) % matches.length
          : (current - 1 + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      selectHolding(matches[activeIndex]);
    }
  }

  const listbox = open && listboxPosition ? (
    <div className="holding-combobox-results" id={listboxId} role="listbox" style={listboxPosition}>
      {matches.length > 0 ? matches.map((holding, index) => (
        <button
          aria-selected={index === activeIndex}
          className={index === activeIndex ? "active" : undefined}
          id={`${listboxId}-${index}`}
          key={holding.symbol}
          role="option"
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => selectHolding(holding)}
        >
          <strong>{holding.symbol}</strong>
          <span>{stockFullLabel(holding)}</span>
        </button>
      )) : (
        <p>현재 운용 포트폴리오에서 일치하는 종목이 없습니다.</p>
      )}
    </div>
  ) : null;

  return (
    <>
      <div className="holding-combobox">
        <input
          aria-activedescendant={open && matches[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          autoComplete="off"
          id="receipt-symbol"
          maxLength={20}
          name="symbol"
          placeholder="티커·종목명 검색"
          ref={inputRef}
          role="combobox"
          value={query}
          required
          onBlur={() => setOpen(false)}
          onChange={changeQuery}
          onFocus={(event) => showListbox(event.currentTarget)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {listbox ? createPortal(listbox, document.body) : null}
    </>
  );
}

export function RecordDistributionReceiptForm({ holdings }: { holdings: readonly SearchableHolding[] }) {
  return (
    <ApiMutationForm action="/api/admin/dividends/receipt" className="form compact" method="post" resetOnSuccess>
      <div className="distribution-receipt-fields">
        <div className="distribution-receipt-row primary">
          <Field htmlFor="receipt-symbol" label="종목">
            <HoldingCombobox holdings={holdings} />
          </Field>
          <Field htmlFor="receipt-currency" label="통화">
            <TdsSelect id="receipt-currency" name="currency" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="KRW">KRW</option>
            </TdsSelect>
          </Field>
          <Field htmlFor="receipt-gross-native" label="외화/원화 총액">
            <input id="receipt-gross-native" min="0.000001" name="grossAmountNative" step="any" type="number" required />
          </Field>
          <Field htmlFor="receipt-exchange-rate" label="실제 체결환율(USD 필수)">
            <FormattedNumberInput allowDecimal id="receipt-exchange-rate" min="1" name="exchangeRate" />
          </Field>
        </div>
        <div className="distribution-receipt-row secondary">
          <Field htmlFor="receipt-foreign-tax" label="외국세(원)">
            <FormattedNumberInput defaultValue="0" id="receipt-foreign-tax" min="0" name="foreignTaxKrw" required />
          </Field>
          <Field htmlFor="receipt-brokerage-fee" label="증권사비용(원)">
            <FormattedNumberInput defaultValue="0" id="receipt-brokerage-fee" min="0" name="brokerageFeeKrw" required />
          </Field>
          <Field htmlFor="receipt-fx-cost" label="환전비용(원)">
            <FormattedNumberInput defaultValue="0" id="receipt-fx-cost" min="0" name="fxCostKrw" required />
          </Field>
          <Field htmlFor="receipt-received-at" label="입금·즉시환전 시각(KST)">
            <input defaultValue={currentKstDateTimeLocal()} id="receipt-received-at" name="receivedAt" type="datetime-local" required />
          </Field>
          <Field htmlFor="receipt-note" label="메모">
            <input id="receipt-note" maxLength={500} name="note" />
          </Field>
          <button className="secondary" type="submit">순입금 원장 기록</button>
        </div>
      </div>
    </ApiMutationForm>
  );
}
