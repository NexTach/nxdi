import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

type SeedEvent = {
  eventDate: string;
  kind: "PLANNED" | "COMPLETED" | "DELAYED" | "CANCELLED";
  category: "CAPITAL_INCREASE" | "REDUCTION" | "REBALANCING" | "TRADE" | "OTHER";
  label?: string;
};

const recurringIncreaseEvents: SeedEvent[] = [
  "2026-07-09",
  "2026-08-09",
  "2026-09-09",
  "2026-10-09",
  "2026-11-09",
  "2026-12-09",
  "2027-01-09"
].map((eventDate, index) => ({
  eventDate,
  kind: "PLANNED",
  category: "CAPITAL_INCREASE",
  label: `ORC 외 정기 특별 증자 · ${index + 1}회차`
}));

const eventsByDisclosureTitle = new Map<string, SeedEvent[]>([
  [
    "[공시] 2026년 7월 1주차 당사 증자 자금 운용 체결 건",
    [{ eventDate: "2026-07-07", kind: "COMPLETED", category: "CAPITAL_INCREASE" }]
  ],
  [
    "[공지] 2026년 7월 2주차 정기 증자 진행 예정 안내",
    [{ eventDate: "2026-07-10", kind: "PLANNED", category: "CAPITAL_INCREASE" }]
  ],
  ["[공지] ORC 외 특별 증자 정기 진행 안내", recurringIncreaseEvents],
  [
    "[공시] KODEX 인버스 매도 체결 안내",
    [{ eventDate: "2026-07-09", kind: "COMPLETED", category: "REBALANCING" }]
  ],
  [
    "[공지] 종목 조정을 위한 보유 종목 매도 안내",
    [{ eventDate: "2026-07-09", kind: "PLANNED", category: "REBALANCING" }]
  ],
  [
    "[공시] 특별 증자 체결 안내 (2026/07/08)",
    [{ eventDate: "2026-07-08", kind: "COMPLETED", category: "CAPITAL_INCREASE" }]
  ],
  [
    "[공시] 수시 특별 증자 체결 안내 (2026/07/09)",
    [{ eventDate: "2026-07-09", kind: "COMPLETED", category: "CAPITAL_INCREASE" }]
  ],
  [
    "[공지] SLVO 외 수시 특별 증자 진행 예정 안내",
    [{ eventDate: "2026-07-10", kind: "PLANNED", category: "CAPITAL_INCREASE" }]
  ],
  [
    "[공지] 동부건설 보유 지분 전량 매도 예정 안내",
    [{ eventDate: "2026-07-09", kind: "PLANNED", category: "REBALANCING" }]
  ],
  [
    "[공시] 동부건설 외 매도 체결 안내",
    [{ eventDate: "2026-07-09", kind: "COMPLETED", category: "REBALANCING" }]
  ],
  [
    "[공시] 수시 특별 증자 체결 안내 (2026/07/10)",
    [{ eventDate: "2026-07-10", kind: "COMPLETED", category: "CAPITAL_INCREASE" }]
  ],
  [
    "[공지] SCHD 외 정기 증자 금액 변경 및 진행 예정 안내",
    [{ eventDate: "2026-07-10", kind: "PLANNED", category: "CAPITAL_INCREASE" }]
  ],
  [
    "[공시] RPAR 매도 및 ITUB 매수 체결 안내",
    [{ eventDate: "2026-07-10", kind: "COMPLETED", category: "REBALANCING" }]
  ],
  [
    "[공지] SLVO 외 수시 특별 증자 일정 연기 안내",
    [{
      eventDate: "2026-07-10",
      kind: "DELAYED",
      category: "CAPITAL_INCREASE",
      label: "SLVO 외 수시 특별 증자 · 자금 확보 시까지 연기"
    }]
  ],
  [
    "[공시] YMAX 외 수시 특별 증자 체결 안내",
    [{ eventDate: "2026-07-11", kind: "COMPLETED", category: "CAPITAL_INCREASE" }]
  ]
]);

async function main() {
  const disclosures = await prisma.disclosure.findMany({
    select: { id: true, title: true }
  });
  const disclosureByTitle = new Map(disclosures.map((disclosure) => [disclosure.title, disclosure]));
  const data: Prisma.RoadmapEventCreateManyInput[] = [];

  for (const [title, events] of eventsByDisclosureTitle) {
    const disclosure = disclosureByTitle.get(title);
    if (!disclosure) {
      console.warn(`Skip missing disclosure: ${title}`);
      continue;
    }

    data.push(...events.map((event) => ({
      disclosureId: disclosure.id,
      eventDate: event.eventDate,
      kind: event.kind,
      category: event.category,
      label: event.label
    })));
  }

  const result = await prisma.roadmapEvent.createMany({
    data,
    skipDuplicates: true
  });

  console.log(`Roadmap backfill complete: ${result.count} created, ${data.length - result.count} already present.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
