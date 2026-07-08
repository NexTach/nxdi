import { LogOut } from "lucide-react";
import { ButtonLink } from "@/app/components/tds";
import type { AppUser } from "@/lib/types";

export function DataGsmLoginButton({ className = "" }: { className?: string }) {
  return (
    <a className={`datagsm-login-button ${className}`.trim()} href="/api/auth/datagsm/start">
      <span className="datagsm-login-logo" aria-hidden="true" />
      <span>DataGSM으로 로그인</span>
    </a>
  );
}

export function AuthNavActions({ user, isAdmin = false }: { user: AppUser | null; isAdmin?: boolean }) {
  if (!user) return <DataGsmLoginButton className="nav-login-button" />;

  return (
    <>
      {isAdmin ? (
        <ButtonLink href="/admin" variant="secondary">
          관리자
        </ButtonLink>
      ) : null}
      <form action="/api/auth/logout" method="post">
        <button className="ghost" type="submit" title="로그아웃">
          <LogOut size={18} />
        </button>
      </form>
    </>
  );
}
