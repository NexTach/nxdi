"use client";

import { type InputHTMLAttributes, useMemo, useState } from "react";

type FormattedNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "inputMode" | "name" | "onChange" | "type" | "value"
> & {
  allowDecimal?: boolean;
  defaultValue?: number | string;
  name?: string;
  onValueChange?: (value: string) => void;
  value?: number | string;
};

function sanitizeNumber(value: number | string | undefined, allowDecimal: boolean) {
  const text = String(value ?? "").replace(/,/g, "");
  let result = "";
  let hasDecimal = false;

  for (const char of text) {
    if (char >= "0" && char <= "9") {
      result += char;
      continue;
    }

    if (allowDecimal && char === "." && !hasDecimal) {
      result += char;
      hasDecimal = true;
    }
  }

  return result;
}

function formatNumberText(value: string, allowDecimal: boolean) {
  if (!value) return "";

  const [integerPart, decimalPart] = value.split(".");
  const formattedInteger = integerPart
    ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Number(integerPart))
    : "0";

  if (allowDecimal && value.includes(".")) {
    return `${formattedInteger}.${decimalPart ?? ""}`;
  }

  return formattedInteger;
}

export function FormattedNumberInput({
  allowDecimal = false,
  defaultValue,
  disabled,
  name,
  onValueChange,
  value,
  ...props
}: FormattedNumberInputProps) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => sanitizeNumber(defaultValue, allowDecimal));
  const rawValue = isControlled ? sanitizeNumber(value, allowDecimal) : uncontrolledValue;
  const displayValue = useMemo(() => formatNumberText(rawValue, allowDecimal), [allowDecimal, rawValue]);

  return (
    <>
      {name ? <input disabled={disabled} name={name} type="hidden" value={rawValue} /> : null}
      <input
        {...props}
        disabled={disabled}
        inputMode={allowDecimal ? "decimal" : "numeric"}
        onChange={(event) => {
          const nextValue = sanitizeNumber(event.currentTarget.value, allowDecimal);
          if (!isControlled) setUncontrolledValue(nextValue);
          onValueChange?.(nextValue);
        }}
        type="text"
        value={displayValue}
      />
    </>
  );
}
