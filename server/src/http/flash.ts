import type { FastifyReply } from "fastify";

export const FLASH_COOKIE_NAME = "nxdi_flash";
export type FlashMessage = { id: string; title: string; description?: string; tone?: "success" | "error" | "info" };

const errors: Record<string, string> = {
  terms_required: "약관 동의가 필요합니다",
  dividend_policy_required: "배당 정책 확인 동의가 필요합니다",
  withdrawal_limit: "출금 가능 금액을 다시 확인해주세요",
  valuation_unavailable: "검증된 환율 또는 평가정보를 확인할 수 없어 출금 처리를 자동 중단했습니다",
  invalid_capital_source: "계약금·입금액·일시를 다시 확인해주세요",
  capital_intent_not_accepted: "수락된 투자 의향서만 별도 계약·입금을 연결할 수 있습니다",
  capital_already_confirmed: "이미 계약·입금이 연결된 의향서입니다",
  compliance_required: "유효한 본인확인·계좌확인·적합성·AML 확인을 먼저 완료해주세요",
  invalid_compliance: "필수 확인 항목과 위험성향 등급을 모두 확인해주세요",
  invalid_capital_return: "반환 가능한 미편입 잔액과 반환 사유를 확인해주세요",
  month_end_snapshot_required: "확정된 월말 포트폴리오 스냅샷이 없어 분배 정산을 중단했습니다",
  distribution_not_found: "확정할 월 분배 정산안이 없습니다",
  distribution_already_finalized: "이미 확정된 월 분배 정산은 변경할 수 없습니다",
  distribution_receipt_required: "해당 월의 종목별 실분배금 순입금 원장이 없어 정산을 중단했습니다",
  invalid_distribution_receipt: "배당 입금액·체결환율·세금·비용·입금시각을 다시 확인해주세요",
  duplicate_distribution_receipt: "동일한 입금 정보로 생성된 내부 원장 ID가 이미 기록되어 있습니다",
  invalid_distribution_receipt_reversal: "반대분개할 실분배금 원장과 사유를 확인해주세요",
  distribution_receipt_changed: "정산안 계산 후 실분배금 원장이 변경되어 확정을 중단했습니다. 정산안을 다시 계산해주세요",
  invalid_distribution_payout: "확정된 투자자 배정과 은행 지급·원천세 거래식별값을 확인해주세요",
  invalid_distribution_payout_failure: "지급 실패 대상과 사유를 확인해주세요",
  invalid_withdrawal_settlement: "실제 출금 정산 입력을 확인해주세요",
  withdrawal_not_accepted: "수락된 출금 의향서만 실제 계약 원장에서 정산할 수 있습니다",
  withdrawal_principal_exceeded: "실제 운용편입 원금을 초과해 출금 정산할 수 없습니다",
  withdrawal_liquidity: "매도·결제가 끝난 포트폴리오 현금이 부족해 출금 정산을 중단했습니다",
  withdrawal_already_settled: "이미 실제 출금 정산이 완료된 의향서입니다",
  invalid_withdrawal_instruction: "별도 출금지시서·서명시각·지급 거래식별값을 확인해주세요",
  invalid_intent_cancel: "철회할 수 있는 본인 의향서를 확인해주세요",
  intent_cancel_downstream: "이미 별도 계약·입금 또는 실제 정산에 연결되어 의향 철회로 처리할 수 없습니다",
  login_required: "로그인이 필요합니다",
  admin_required: "관리자 권한이 필요합니다",
  trade_not_found: "거래를 적용할 종목을 찾을 수 없습니다",
  trade_insufficient: "매도 수량이 현재 보유 수량보다 큽니다",
  holding_not_empty: "보유 수량이 남은 종목은 직접 삭제할 수 없습니다. 실제 매도 체결로 수량을 먼저 정리해주세요",
  risk_unclassified: "상대 위험등급이 지정되지 않은 종목의 신규 매수를 중단했습니다",
  invalid_exchange_rate: "환율 입력값을 다시 확인해주세요",
  status_principal_invariant: "수락 출금 의향 합계는 수락 투자 의향 합계를 초과할 수 없습니다",
  snapshot_not_found: "확정할 스냅샷을 찾을 수 없습니다",
  dividend_sync_failed: "외부 배당 데이터를 가져오지 못했습니다",
  oauth_state: "OAuth state 검증에 실패했습니다. 다시 로그인하세요.",
  not_eligible: "재학생 또는 졸업생으로 확인되지 않아 이용할 수 없습니다.",
  oauth_origin: "접속 주소와 OAuth 콜백 주소가 다릅니다. 같은 주소로 접속하세요.",
  oauth_failed: "DataGSM 로그인 처리 중 오류가 발생했습니다.",
  datagsm_not_configured: "DataGSM OAuth 환경변수가 아직 설정되지 않았습니다."
};

export function errorFlash(code: string): FlashMessage {
  return { id: `error-${code}`, title: errors[code] ?? "입력값을 다시 확인해주세요", tone: "error" };
}

export function successFlash(id: string, title: string): FlashMessage {
  return { id, title, tone: "success" };
}

export function setFlash(reply: FastifyReply, message: FlashMessage) {
  reply.setCookie(FLASH_COOKIE_NAME, Buffer.from(JSON.stringify(message)).toString("base64url"), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60,
    path: "/"
  });
}

export function redirectWithFlash(reply: FastifyReply, path: string, message: FlashMessage, statusCode = 303) {
  const accept = reply.request.headers.accept ?? "";
  if (accept.split(",").some((value) => value.trim().split(";", 1)[0] === "application/json")) {
    return reply
      .code(message.tone === "error" ? 400 : 200)
      .send({ redirectTo: path, message });
  }

  setFlash(reply, message);
  return reply.redirect(path, statusCode);
}
