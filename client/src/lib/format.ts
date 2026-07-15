export function formatKrw(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

export function formatCurrency(value: number, currency: "KRW" | "USD", digits = currency === "KRW" ? 0 : 2) {
  if (currency === "KRW") return formatKrw(value);

  const formatted = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits
  }).format(Math.abs(value));
  return `${value < 0 ? "-" : ""}$${formatted}`;
}

export function currencySymbol(currency: "KRW" | "USD") {
  return currency === "KRW" ? "₩" : "$";
}

export function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function statusLabel(status: string) {
  if (status === "ACCEPTED") return "수락";
  if (status === "REJECTED") return "거절";
  if (status === "WITHDRAWN") return "철회";
  return "대기";
}
