import { fetchExternal } from "./external-http.js";

const USD_KRW_ENDPOINT = "https://open.er-api.com/v6/latest/USD";
const REVALIDATE_SECONDS = 60 * 10;
export const MAX_VERIFIED_EXCHANGE_RATE_AGE_MS = 36 * 60 * 60 * 1000;

type ExchangeRateApiResponse = {
  result?: string;
  time_last_update_utc?: string;
  rates?: {
    KRW?: number;
  };
};

export type ExchangeRateSnapshot = {
  pair: "USD/KRW";
  rate: number;
  fetchedAt: string;
  source: "open.er-api.com";
};

let lastSuccessfulSnapshot: ExchangeRateSnapshot | undefined;
let lastRequestAt = 0;
let inFlightRequest: Promise<ExchangeRateSnapshot> | undefined;

export class ExchangeRateUnavailableError extends Error {
  readonly statusCode = 503;

  constructor() {
    super("Verified USD/KRW exchange rate unavailable");
    this.name = "ExchangeRateUnavailableError";
  }
}

function validUsdKrwRate(value?: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 500 && value <= 3000;
}

export function isVerifiedExchangeRateFresh(
  snapshot: Pick<ExchangeRateSnapshot, "fetchedAt" | "source">,
  now = Date.now()
) {
  if (snapshot.source !== "open.er-api.com") return false;
  const fetchedAt = new Date(snapshot.fetchedAt).getTime();
  return Number.isFinite(fetchedAt) && fetchedAt <= now && now - fetchedAt <= MAX_VERIFIED_EXCHANGE_RATE_AGE_MS;
}

export async function fetchUsdKrwExchangeRate(): Promise<ExchangeRateSnapshot> {
  if (lastSuccessfulSnapshot && Date.now() - lastRequestAt < REVALIDATE_SECONDS * 1000) {
    return lastSuccessfulSnapshot;
  }
  if (inFlightRequest) return inFlightRequest;
  inFlightRequest = (async () => {
    lastRequestAt = Date.now();
    try {
      const response = await fetchExternal(USD_KRW_ENDPOINT, {}, { timeoutMs: 1500, retries: 0 });
      if (!response.ok) throw new Error(`Exchange rate fetch failed: ${response.status}`);

      const json = (await response.json()) as ExchangeRateApiResponse;
      const rate = json.rates?.KRW;
      if (json.result !== "success" || !validUsdKrwRate(rate)) {
        throw new Error("Exchange rate response did not contain a valid KRW rate");
      }

      lastSuccessfulSnapshot = {
        pair: "USD/KRW",
        rate,
        fetchedAt: json.time_last_update_utc
          ? new Date(json.time_last_update_utc).toISOString()
          : new Date().toISOString(),
        source: "open.er-api.com"
      };
      return lastSuccessfulSnapshot;
    } catch {
      if (lastSuccessfulSnapshot && isVerifiedExchangeRateFresh(lastSuccessfulSnapshot)) {
        return lastSuccessfulSnapshot;
      }
      throw new ExchangeRateUnavailableError();
    }
  })();
  try { return await inFlightRequest; } finally { inFlightRequest = undefined; }
}
