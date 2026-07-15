"use client";

import { ApiMutationForm } from "@/app/components/api-mutation-form";
import { Field, TdsSelect } from "@/app/components/tds";

export function ApproveComplianceForm({
  userId,
  userName,
  userEmail
}: {
  userId: string;
  userName: string;
  userEmail: string;
}) {
  return (
    <details>
      <summary>사전확인 기록</summary>
      <ApiMutationForm action="/api/admin/compliance/approve" className="form compact" method="post">
        <input name="userId" type="hidden" value={userId} />
        <input name="userName" type="hidden" value={userName} />
        <input name="userEmail" type="hidden" value={userEmail} />
        <Field htmlFor={`risk-grade-${userId}`} label="확인된 위험성향">
          <TdsSelect id={`risk-grade-${userId}`} name="riskGrade" defaultValue="AGGRESSIVE" required>
            <option value="CONSERVATIVE">안정형</option>
            <option value="MODERATE">중립형</option>
            <option value="AGGRESSIVE">공격형</option>
          </TdsSelect>
        </Field>
        <label><input name="realNameVerified" type="checkbox" value="true" required /> 실명·신분 확인 완료</label>
        <label><input name="bankAccountVerified" type="checkbox" value="true" required /> 본인명의 계좌 확인 완료</label>
        <label><input name="suitabilityCompleted" type="checkbox" value="true" required /> 적합성·위험감수능력 확인 완료</label>
        <label><input name="amlCleared" type="checkbox" value="true" required /> 자금출처·AML 확인 완료</label>
        <label><input name="sanctionsChecked" type="checkbox" value="true" required /> 제재·고위험대상 확인 완료</label>
        <label><input name="guardianVerified" type="checkbox" value="true" /> 법정대리인 확인 완료(해당 시)</label>
        <Field htmlFor={`compliance-note-${userId}`} label="확인 근거·메모">
          <input id={`compliance-note-${userId}`} maxLength={500} name="note" />
        </Field>
        <button className="secondary" type="submit">확인 기록(1년 유효)</button>
      </ApiMutationForm>
    </details>
  );
}
