"use client";

import { ApiMutationForm } from "@/app/components/api-mutation-form";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import { Field } from "@/app/components/tds";

function currentKstDateTimeLocal() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function ConfirmCapitalForm({ intentId, intentAmountKrw }: {
  intentId: string;
  intentAmountKrw: number;
}) {
  return (
    <details>
      <summary>별도 계약·입금 확인</summary>
      <ApiMutationForm action="/api/admin/capital/confirm" className="form compact" method="post">
        <input name="investmentIntentId" type="hidden" value={intentId} />
        <Field htmlFor={`contract-reference-${intentId}`} label="계약서 식별값">
          <input id={`contract-reference-${intentId}`} maxLength={120} name="contractReference" required />
        </Field>
        <Field htmlFor={`contract-version-${intentId}`} label="계약서 버전">
          <input id={`contract-version-${intentId}`} maxLength={32} name="contractVersion" placeholder="예: 2026-07-15" required />
        </Field>
        <Field htmlFor={`deposit-reference-${intentId}`} label="입금 거래식별값">
          <input id={`deposit-reference-${intentId}`} maxLength={120} name="depositReference" required />
        </Field>
        <Field htmlFor={`contracted-${intentId}`} label="실제 계약금">
          <FormattedNumberInput
            defaultValue={String(intentAmountKrw)}
            id={`contracted-${intentId}`}
            min="1"
            name="contractedAmountKrw"
            required
          />
        </Field>
        <Field htmlFor={`received-${intentId}`} label="실제 입금액">
          <FormattedNumberInput
            defaultValue={String(intentAmountKrw)}
            id={`received-${intentId}`}
            min="1"
            name="receivedAmountKrw"
            required
          />
        </Field>
        <Field htmlFor={`contracted-at-${intentId}`} label="계약시각 (KST)">
          <input
            defaultValue={currentKstDateTimeLocal()}
            id={`contracted-at-${intentId}`}
            name="contractedAt"
            type="datetime-local"
            required
          />
        </Field>
        <Field htmlFor={`received-at-${intentId}`} label="입금시각 (KST)">
          <input
            defaultValue={currentKstDateTimeLocal()}
            id={`received-at-${intentId}`}
            name="receivedAt"
            type="datetime-local"
            required
          />
        </Field>
        <Field htmlFor={`capital-note-${intentId}`} label="계약·입금 확인 메모">
          <input id={`capital-note-${intentId}`} maxLength={500} name="note" />
        </Field>
        <button className="secondary" type="submit">미편입 예수금 기록</button>
      </ApiMutationForm>
    </details>
  );
}
