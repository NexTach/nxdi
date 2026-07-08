import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { AuthNavActions } from "@/app/components/auth-actions";
import { IntentLink } from "@/app/components/intent-link";
import { PolicyMarkdown } from "@/app/components/policy-markdown";
import {
  AppShell,
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

  const markdown = await readProductDescription();

  return (
    <AppShell>
      <Navigation
        title="T-ETF 상품 설명"
        description={user ? `${user.name} · Markdown 문서` : "Markdown 문서"}
        actions={<AuthNavActions user={user} />}
      />

      <Top
        backLink={{ href: "/", label: "포트폴리오" }}
        title="상품 설명"
        actions={
          <IntentLink signedIn={Boolean(user)} />
        }
      />

      <Panel className="markdown-panel">
        <article className="markdown-body">
          <PolicyMarkdown markdown={markdown} />
        </article>
      </Panel>

      <Notice className="mt-18">
        표시된 설명은 투자 권유나 투자자문이 아니며, 실제 계약 조건은 서비스 외부에서 별도로 확인해야 합니다.
      </Notice>
    </AppShell>
  );
}
