import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RoadmapEditor } from "./roadmap-editor";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("RoadmapEditor", () => {
  it("allows a new pin date earlier than today", () => {
    const markup = renderToStaticMarkup(createElement(RoadmapEditor, {
      disclosures: [{
        id: "disclosure-1",
        title: "[공지] 테스트 공시",
        body: "테스트 본문",
        createdAt: "2026-07-01T00:00:00.000Z"
      }],
      events: [],
      today: "2026-07-15"
    }));

    assert.match(markup, /id="[^"]+-fallback-date"[^>]*type="date"/);
    assert.doesNotMatch(markup, /id="[^"]+-fallback-date"[^>]*min="2026-07-15"/);
  });
});
