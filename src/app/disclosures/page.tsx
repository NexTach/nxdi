import type { Metadata } from "next";
import { AuthNavActions } from "@/app/components/auth-actions";
import { PaginatedList } from "@/app/components/client-pagination";
import { DisclosureTradeSummary } from "@/app/components/disclosure-trades";
import { RoadmapTimeline } from "@/app/components/roadmap-timeline";
import {
  AppShell,
  Empty,
  ListRow,
  Navigation,
  RowMeta,
  SectionHeader,
  TextLink,
  Top
} from "@/app/components/tds";
import { readDisclosures } from "@/lib/disclosures";
import { formatDateTime } from "@/lib/format";
import {
  ROADMAP_HORIZON_DAYS,
  addDaysToDateKey,
  kstDateKey,
  readRoadmapEvents
} from "@/lib/roadmap";
import { getUserSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "공시 | TDIV",
  description: "TDIV 운용 로드맵과 공시 목록"
};

const DISCLOSURES_PAGE_SIZE = 10;

export default async function DisclosuresPage() {
  const todayDateKey = kstDateKey();
  const throughDateKey = addDaysToDateKey(todayDateKey, ROADMAP_HORIZON_DAYS);

  const [user, disclosures, roadmapEvents] = await Promise.all([
    getUserSession(),
    readDisclosures(),
    readRoadmapEvents({ through: throughDateKey })
  ]);

  return (
    <AppShell>
      <Navigation
        title="TDIV 공시"
        description={user ? `${user.name} · 공시 목록` : "공시 목록"}
        actions={<AuthNavActions user={user} />}
      />

      <Top
        backLink={{ href: "/", label: "포트폴리오" }}
        title="공시"
        description="앞으로의 운용 일정과 증자, 포트폴리오 변경, 매수·매도 이력을 함께 확인할 수 있습니다."
      />

      <div id="roadmap">
        <RoadmapTimeline
          events={roadmapEvents}
          todayDateKey={todayDateKey}
          throughDateKey={throughDateKey}
        />
      </div>

      <SectionHeader
        title="전체 공시"
        description="운영 변경과 첨부 거래 이력을 최신순으로 확인합니다."
      />

      {disclosures.length > 0 ? (
        <PaginatedList className="disclosure-list" label="공시 페이지" pageSize={DISCLOSURES_PAGE_SIZE}>
          {disclosures.map((disclosure) => (
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
        </PaginatedList>
      ) : (
        <Empty>등록된 공시가 없습니다.</Empty>
      )}
    </AppShell>
  );
}
