import { redirect } from "next/navigation";
import { ToastStack, type ToastMessage } from "@/app/components/toast";
import { AppShell } from "@/app/components/tds";
import { getUserSession } from "@/lib/session";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function errorMessage(error?: string | string[]) {
  const value = Array.isArray(error) ? error[0] : error;
  if (value === "datagsm_not_configured") return "DataGSM OAuth 환경변수가 아직 설정되지 않았습니다.";
  if (value === "not_eligible") return "재학생 또는 졸업생으로 확인되지 않아 이용할 수 없습니다.";
  if (value === "oauth_state") return "OAuth state 검증에 실패했습니다. 다시 로그인하세요.";
  if (value === "oauth_origin") return "접속 주소와 OAuth 콜백 주소가 다릅니다. 같은 주소로 접속하세요.";
  if (value === "oauth_failed") return "DataGSM 로그인 처리 중 오류가 발생했습니다.";
  return null;
}

function loginToastMessages(message: string | null): ToastMessage[] {
  if (!message) return [];
  return [{ id: "login-error", title: message, tone: "error" }];
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getUserSession();
  if (user) redirect("/");

  const params = (await searchParams) ?? {};
  const message = errorMessage(params.error);

  return (
    <AppShell className="login-shell">
      <ToastStack messages={loginToastMessages(message)} />

      <section className="login-gate" aria-labelledby="login-title">
        <div className="login-brand" aria-label="T-ETF">
          <div className="login-brand-mark" aria-hidden="true">T</div>
          <h1 id="login-title">T-ETF</h1>
        </div>

        <a className="datagsm-login-button" href="/api/auth/datagsm/start">
          <span className="datagsm-login-logo" aria-hidden="true" />
          <span>DataGSM으로 로그인</span>
        </a>
      </section>
    </AppShell>
  );
}
