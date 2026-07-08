import { promises as fs } from "fs";
import path from "path";
import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AppShell,
  ButtonLink,
  Navigation,
  Notice,
  Panel,
  Top
} from "@/app/components/tds";
import { getUserSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "상품 설명 | T-ETF",
  description: "T-ETF 상품 설명 Markdown 문서"
};

async function readProductDescription() {
  const filePath = path.join(process.cwd(), "content", "product-description.md");
  return fs.readFile(filePath, "utf8");
}

export default async function ProductPage() {
  const user = await getUserSession();
  if (!user) redirect("/login");

  const markdown = await readProductDescription();

  return (
    <AppShell>
      <Navigation
        title="T-ETF 상품 설명"
        description={`${user.name} · Markdown 문서`}
        actions={
          <form action="/api/auth/logout" method="post">
            <button className="ghost" type="submit" title="로그아웃">
              <LogOut size={18} />
            </button>
          </form>
        }
      />

      <Top
        backLink={{ href: "/", label: "포트폴리오" }}
        title="상품 설명"
        actions={
          <ButtonLink href="/intents">
            의향서 작성
          </ButtonLink>
        }
      />

      <Panel className="markdown-panel">
        <article className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      </Panel>

      <Notice className="mt-18">
        표시된 설명은 투자 권유나 투자자문이 아니며, 실제 계약 조건은 서비스 외부에서 별도로 확인해야 합니다.
      </Notice>
    </AppShell>
  );
}
