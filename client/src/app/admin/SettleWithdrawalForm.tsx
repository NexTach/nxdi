"use client";

import { ApiMutationForm } from "@/app/components/api-mutation-form";
import { Field } from "@/app/components/tds";

function currentKstDateTimeLocal() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function SettleWithdrawalForm({ intentId }: { intentId: string }) {
  return (
    <details>
      <summary>별도 지시·지급 후 정산</summary>
      <ApiMutationForm action="/api/admin/withdrawals/settle" className="form compact" method="post">
        <input name="withdrawalIntentId" type="hidden" value={intentId} />
        <Field htmlFor={`withdrawal-instruction-${intentId}`} label="출금지시서 식별값">
          <input id={`withdrawal-instruction-${intentId}`} maxLength={120} name="instructionReference" required />
        </Field>
        <Field htmlFor={`withdrawal-signed-${intentId}`} label="지시서 서명시각(KST)">
          <input defaultValue={currentKstDateTimeLocal()} id={`withdrawal-signed-${intentId}`} name="instructionSignedAt" type="datetime-local" required />
        </Field>
        <Field htmlFor={`withdrawal-payout-${intentId}`} label="은행 지급 거래식별값">
          <input id={`withdrawal-payout-${intentId}`} maxLength={120} name="payoutReference" required />
        </Field>
        <Field htmlFor={`withdrawal-note-${intentId}`} label="정산 메모">
          <input id={`withdrawal-note-${intentId}`} maxLength={500} name="note" />
        </Field>
        <button className="secondary" type="submit">매도·결제·지급 완료 기록</button>
      </ApiMutationForm>
    </details>
  );
}
