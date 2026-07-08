import type { Metadata } from "next";
import { AuthNavActions } from "@/app/components/auth-actions";
import { DisclosureTradeSummary } from "@/app/components/disclosure-trades";
import {
  AppShell,
  Empty,
  List,
  ListRow,
  Navigation,
  Pagination,
  RowMeta,
  TextLink,
  Top
} from "@/app/components/tds";
import { readDisclosures } from "@/lib/disclosures";
import { formatDateTime } from "@/lib/format";
import { pageFromSearchParams, paginateItems } from "@/lib/pagination";
import { getUserSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "공시 | T-ETF",
  description: "T-ETF 공시 목록"
};

type DisclosuresProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const DISCLOSURES_PAGE_SIZE = 10;

export default async function DisclosuresPage({ searchParams }: DisclosuresProps) {
  const user = await getUserSession();

  const params = (await searchParams) ?? {};
  const disclosures = await readDisclosures();
  const paginatedDisclosures = paginateItems(
    disclosures,
    pageFromSearchParams(params, "page"),
    DISCLOSURES_PAGE_SIZE
  );

  return (
    <AppShell>
      <Navigation
        title="T-ETF 공시"
        description={user ? `${user.name} · 공시 목록` : "공시 목록"}
        actions={<AuthNavActions user={user} />}
      />

      <Top
        backLink={{ href: "/", label: "포트폴리오" }}
        title="공시"
        description="운영 증자, 포트폴리오 변경, 매수·매도 이력을 확인할 수 있습니다."
      />

      {disclosures.length > 0 ? (
        <>
          <List className="disclosure-list">
            {paginatedDisclosures.items.map((disclosure) => (
              <ListRow
                key={disclosure.id}
                title={<TextLink href={`/disclosures/${disclosure.id}`}>{disclosure.title}</TextLink>}
                description={disclosure.body.slice(0, 100) + (disclosure.body.length > 100 ? "..." : "")}
                value={<TextLink href={`/disclosures/${disclosure.id}`}>상세</TextLink>}
              >
                <RowMeta>{formatDateTime(disclosure.createdAt)}</RowMeta>
                <DisclosureTradeSummary trades={disclosure.trades} />
              </ListRow>
            ))}
          </List>
          <Pagination
            label="공시 페이지"
            pageInfo={paginatedDisclosures.pageInfo}
            pageParam="page"
            searchParams={params}
          />
        </>
      ) : (
        <Empty>등록된 공시가 없습니다.</Empty>
      )}
    </AppShell>
  );
}
