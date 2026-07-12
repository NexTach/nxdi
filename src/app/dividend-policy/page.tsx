import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { AuthNavActions } from "@/app/components/auth-actions";
import { IntentLink } from "@/app/components/intent-link";
import { PolicyMarkdown } from "@/app/components/policy-markdown";
import {
  AppShell,
  ButtonLink,
  Navigation,
  Panel,
  Top
} from "@/app/components/tds";
import { getUserSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "배당 정책 | TDIV",
  description: "TDIV 배당 정책 Markdown 문서"
};

async function readDividendPolicy() {
  const filePath = path.join(process.cwd(), "content", "dividend-policy.md");
  return fs.readFile(filePath, "utf8");
}

export default async function DividendPolicyPage() {
  const user = await getUserSession();
  const markdown = await readDividendPolicy();

  return (
    <AppShell>
      <Navigation
        title="TDIV 배당 정책"
        description={user ? `${user.name} · Markdown 문서` : "Markdown 문서"}
        actions={<AuthNavActions user={user} />}
      />

      <Top
        backLink={{ href: "/", label: "포트폴리오" }}
        title="배당 정책"
        actions={
          <>
            <ButtonLink href="/product" variant="secondary">
              상품 설명
            </ButtonLink>
            <IntentLink signedIn={Boolean(user)} />
          </>
        }
      />

      <Panel className="markdown-panel">
        <article className="markdown-body">
          <PolicyMarkdown markdown={markdown} />
        </article>
      </Panel>
    </AppShell>
  );
}
