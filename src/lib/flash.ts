import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const FLASH_COOKIE_NAME = "tdiv_flash";

export type FlashMessage = {
  id: string;
  title: string;
  description?: string;
  tone?: "success" | "error" | "info";
};

const authErrorTitles: Record<string, string> = {
  datagsm_not_configured: "DataGSM OAuth 환경변수가 아직 설정되지 않았습니다.",
  not_eligible: "재학생 또는 졸업생으로 확인되지 않아 이용할 수 없습니다.",
  oauth_state: "OAuth state 검증에 실패했습니다. 다시 로그인하세요.",
  oauth_origin: "접속 주소와 OAuth 콜백 주소가 다릅니다. 같은 주소로 접속하세요.",
  oauth_failed: "DataGSM 로그인 처리 중 오류가 발생했습니다."
};

const adminErrorTitles: Record<string, string> = {
  invalid_status: "상태 값을 다시 확인해주세요",
  invalid_holding: "포트폴리오 입력값을 다시 확인해주세요",
  invalid_trade: "거래 입력값을 다시 확인해주세요",
  trade_not_found: "거래를 적용할 종목을 찾을 수 없습니다",
  trade_insufficient: "매도 수량이 현재 보유 수량보다 큽니다",
  invalid_delete: "삭제할 종목을 다시 확인해주세요",
  invalid_exchange_rate: "환율 입력값을 다시 확인해주세요",
  invalid_dividend: "배당 입력값을 다시 확인해주세요",
  invalid_dividend_months: "배당 지급월을 다시 확인해주세요",
  invalid_dividend_delete: "삭제할 배당 데이터를 다시 확인해주세요",
  invalid_dividend_sync: "동기화할 종목을 다시 확인해주세요",
  dividend_sync_failed: "외부 배당 데이터를 가져오지 못했습니다",
  invalid_monthly_dividend: "실 배당 입력값을 다시 확인해주세요",
  invalid_monthly_dividend_delete: "삭제할 실 배당 기록을 다시 확인해주세요",
  invalid_snapshot: "확정할 스냅샷 날짜를 다시 확인해주세요",
  snapshot_not_found: "확정할 스냅샷을 찾을 수 없습니다",
  invalid_disclosure: "공시 입력값을 다시 확인해주세요",
  invalid_disclosure_trade: "공시 거래 이력 입력값을 다시 확인해주세요",
  invalid_disclosure_delete: "삭제할 공시를 다시 확인해주세요"
};

export function authErrorFlash(error: string): FlashMessage {
  return {
    id: `auth-error-${error}`,
    title: authErrorTitles[error] ?? "로그인 처리 중 오류가 발생했습니다.",
    tone: "error"
  };
}

export function adminErrorFlash(error: string): FlashMessage {
  return {
    id: `admin-error-${error}`,
    title: adminErrorTitles[error] ?? "요청을 처리하지 못했습니다",
    tone: "error"
  };
}

export function adminSuccessFlash(
  kind: "updated" | "portfolio" | "dividend" | "monthlyDividend" | "disclosure",
  value?: string
): FlashMessage {
  if (kind === "updated") {
    return { id: "admin-updated", title: "상태가 저장되었습니다", tone: "success" };
  }

  if (kind === "portfolio") {
    return {
      id: `portfolio-${value ?? "updated"}`,
      title:
        value === "deleted"
          ? "포트폴리오 종목이 삭제되었습니다"
          : value === "traded"
            ? "거래가 포트폴리오에 반영되었습니다"
            : "포트폴리오가 저장되었습니다",
      tone: "success"
    };
  }

  if (kind === "dividend") {
    return {
      id: `dividend-${value ?? "updated"}`,
      title:
        value === "synced"
          ? "배당 데이터가 동기화되었습니다"
          : value === "deleted"
            ? "배당 데이터가 삭제되었습니다"
            : "배당 데이터가 저장되었습니다",
      tone: "success"
    };
  }

  if (kind === "monthlyDividend") {
    return {
      id: `monthly-dividend-${value ?? "updated"}`,
      title: value === "deleted" ? "실 배당 기록이 삭제되었습니다" : "실 배당 기록이 저장되었습니다",
      tone: "success"
    };
  }

  return {
    id: `disclosure-${value ?? "created"}`,
    title:
      value === "deleted"
        ? "공시가 삭제되었습니다"
        : value === "updated"
          ? "공시가 수정되었습니다"
          : "공시가 등록되었습니다",
    tone: "success"
  };
}

export function intentErrorFlash(error: string): FlashMessage {
  return {
    id: `intent-error-${error}`,
    title:
      error === "terms_required"
        ? "약관 동의가 필요합니다"
        : error === "dividend_policy_required"
          ? "배당 정책 확인 동의가 필요합니다"
          : error === "withdrawal_limit"
            ? "출금 가능 금액을 다시 확인해주세요"
            : "입력값을 다시 확인해주세요",
    tone: "error"
  };
}

export function intentSubmittedFlash(): FlashMessage {
  return {
    id: "intent-submitted",
    title: "의향서가 제출되었습니다",
    description: "관리자가 확인 후 상태를 변경합니다.",
    tone: "success"
  };
}

export function loginRequiredFlash(): FlashMessage {
  return {
    id: "login-required",
    title: "로그인이 필요합니다",
    description: "DataGSM으로 로그인한 뒤 의향서를 작성해주세요.",
    tone: "info"
  };
}

function encodeFlash(message: FlashMessage) {
  return Buffer.from(JSON.stringify(message)).toString("base64url");
}

function decodeFlash(value?: string) {
  if (!value) return null;

  try {
    const message = JSON.parse(Buffer.from(value, "base64url").toString()) as FlashMessage;
    if (!message || typeof message.id !== "string" || typeof message.title !== "string") return null;
    return message;
  } catch {
    return null;
  }
}

export async function getFlashMessages() {
  const cookieStore = await cookies();
  const message = decodeFlash(cookieStore.get(FLASH_COOKIE_NAME)?.value);
  return message ? [message] : [];
}

export function redirectWithFlash(request: Request, path: string, message: FlashMessage, status = 303) {
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL(path, request.url), { status });

  response.cookies.set(FLASH_COOKIE_NAME, encodeFlash(message), {
    httpOnly: false,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    maxAge: 60,
    path: "/"
  });

  return response;
}
