"use client";

import { ApiMutationForm } from "@/app/components/api-mutation-form";
import { FormattedNumberInput } from "@/app/components/formatted-number-input";
import { Field, InlineFields } from "@/app/components/tds";

function currentMonthValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyDividendRecordForm() {
  return (
    <ApiMutationForm
      action="/api/admin/dividends/monthly/record"
      className="form compact monthly-dividend-form"
      method="post"
      resetOnSuccess
    >
      <InlineFields variant="monthly-dividend">
        <Field htmlFor="actual-dividend-month" label="배당월">
          <input
            id="actual-dividend-month"
            name="dividendMonth"
            type="month"
            defaultValue={currentMonthValue()}
            required
          />
        </Field>
        <Field htmlFor="actual-dividend-withholding-rate" label="적용 원천세율 (%)">
          <FormattedNumberInput
            allowDecimal
            id="actual-dividend-withholding-rate"
            min="0"
            max="100"
            name="withholdingRate"
            placeholder="세무 확인 세율"
            required
          />
        </Field>
        <Field htmlFor="actual-dividend-memo" label="메모" wide>
          <input id="actual-dividend-memo" maxLength={500} name="memo" placeholder="선택 입력" />
        </Field>
        <button className="secondary" type="submit">
          원장 합계로 정산안 계산
        </button>
      </InlineFields>
    </ApiMutationForm>
  );
}
