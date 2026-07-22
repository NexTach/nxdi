import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveRoadmapCategory,
  deriveRoadmapKind,
  isRoadmapQueryWindow,
  roadmapInitialStartDate
} from "../src/infrastructure/roadmap.js";

describe("Given a roadmap viewer date window", () => {
  describe("when the initial window is created", () => {
    it("then starts 30 days before today", () => {
      assert.equal(roadmapInitialStartDate("2026-07-18"), "2026-06-18");
    });
  });

  describe("when an additional window is requested", () => {
    it("then accepts at most 30 chronological days", () => {
      assert.equal(isRoadmapQueryWindow("2026-05-19", "2026-06-17"), true);
      assert.equal(isRoadmapQueryWindow("2026-06-19", "2026-07-18"), true);
      assert.equal(isRoadmapQueryWindow("2026-06-18", "2026-07-18"), false);
      assert.equal(isRoadmapQueryWindow("2026-07-18", "2026-07-17"), false);
      assert.equal(isRoadmapQueryWindow("2026-02-29", "2026-03-01"), false);
    });
  });
});

describe("Given a disclosure owned by the server", () => {
  describe("when its default roadmap status is derived", () => {
    it("then prioritizes the title over potentially stale body wording", () => {
      assert.equal(
        deriveRoadmapKind(
          "[공시] YMAX 외 수시 특별 증자 체결 안내",
          "기존 계획의 일정 연기에 따른 보완 조치입니다."
        ),
        "COMPLETED"
      );
      assert.equal(deriveRoadmapKind("[공지] SLVO 외 수시 특별 증자 일정 연기 안내"), "DELAYED");
      assert.equal(deriveRoadmapKind("[공지] 정기 증자 진행 예정 안내"), "PLANNED");
      assert.equal(deriveRoadmapKind("운용 계획 철회 안내"), "CANCELLED");
    });
  });

  describe("when its roadmap business category is derived", () => {
    it("then classifies the title and body using the authoritative server policy", () => {
      assert.equal(deriveRoadmapCategory("[공지] 정기 증자 예정 안내"), "CAPITAL_INCREASE");
      assert.equal(deriveRoadmapCategory("[공지] 자본 감소를 위한 감자 안내"), "REDUCTION");
      assert.equal(
        deriveRoadmapCategory(
          "[공시] RPAR 매도 및 ITUB 매수 체결 안내",
          "리밸런싱을 위한 거래입니다."
        ),
        "REBALANCING"
      );
      assert.equal(deriveRoadmapCategory("[공시] 보유 종목 매도 체결 안내"), "TRADE");
      assert.equal(deriveRoadmapCategory("[공지] 정기 운영 안내"), "OTHER");
    });
  });
});
