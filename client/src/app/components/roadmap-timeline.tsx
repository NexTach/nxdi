"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, LocateFixed } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from "react";
import {
  addDaysToDateKey,
  groupRoadmapEventsByDate,
  roadmapCategoryLabel,
  roadmapDateKeys,
  roadmapKindLabel,
  sortRoadmapEvents,
  stripDisclosureTag,
  type RoadmapEvent
} from "@/lib/roadmap";

type RoadmapTimelineProps = {
  events: RoadmapEvent[];
  fromDateKey: string;
  todayDateKey: string;
  throughDateKey: string;
};

type RoadmapFilter = "ALL" | "PLANNED" | "COMPLETED" | "CHANGED";

const ROADMAP_FILTERS: Array<{ id: RoadmapFilter; label: string }> = [
  { id: "ALL", label: "전체" },
  { id: "PLANNED", label: "예정" },
  { id: "COMPLETED", label: "완료" },
  { id: "CHANGED", label: "변경" }
];

const COLLAPSED_EVENTS_PER_DATE = 1;
const MOUSE_DRAG_THRESHOLD_PX = 5;
const ROADMAP_PAGE_DAYS = 30;
const LOAD_MORE_THRESHOLD_PX = 520;

type MouseDragState = {
  pointerId: number;
  captureTarget: Element;
  startClientX: number;
  startScrollLeft: number;
  didDrag: boolean;
};

const roadmapDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul"
});

const roadmapWeekdayFormatter = new Intl.DateTimeFormat("ko-KR", {
  weekday: "short",
  timeZone: "Asia/Seoul"
});

function dateFromDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00+09:00`);
}

function roadmapDateLabel(dateKey: string) {
  return roadmapDateFormatter.format(dateFromDateKey(dateKey));
}

function roadmapWeekdayLabel(dateKey: string) {
  return roadmapWeekdayFormatter.format(dateFromDateKey(dateKey));
}

function timelineScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function eventMatchesFilter(event: RoadmapEvent, filter: RoadmapFilter) {
  if (filter === "ALL") return true;
  if (filter === "CHANGED") return event.kind === "DELAYED" || event.kind === "CANCELLED";
  return event.kind === filter;
}

function filterCount(events: RoadmapEvent[], filter: RoadmapFilter) {
  return events.reduce((count, event) => count + (eventMatchesFilter(event, filter) ? 1 : 0), 0);
}

function roadmapEventTitle(event: RoadmapEvent) {
  return event.label?.trim() || stripDisclosureTag(event.disclosure.title) || "로드맵 일정";
}

function roadmapEventSummary(event: RoadmapEvent) {
  const summary = event.disclosure.body.replace(/\s+/g, " ").trim();
  return summary.length > 86 ? `${summary.slice(0, 86)}…` : summary;
}

export function RoadmapTimeline({
  events,
  fromDateKey,
  todayDateKey,
  throughDateKey
}: RoadmapTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<RoadmapFilter>("ALL");
  const [expandedDateKeys, setExpandedDateKeys] = useState<Set<string>>(() => new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState(() => sortRoadmapEvents(events));
  const [rangeStart, setRangeStart] = useState(fromDateKey);
  const [rangeEnd, setRangeEnd] = useState(throughDateKey);
  const viewportRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLLIElement>(null);
  const didInitialScrollRef = useRef(false);
  const mouseDragRef = useRef<MouseDragState | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickFrameRef = useRef<number | null>(null);
  const loadInProgressRef = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const pendingPrependRef = useRef<{ scrollLeft: number; scrollWidth: number } | null>(null);

  const visibleEvents = useMemo(
    () => timelineEvents.filter((event) => eventMatchesFilter(event, activeFilter)),
    [activeFilter, timelineEvents]
  );

  const eventsByDate = useMemo(() => {
    return new Map(
      groupRoadmapEventsByDate(visibleEvents).map((group) => [group.dateKey, group.events])
    );
  }, [visibleEvents]);

  const dateKeys = useMemo(
    () => roadmapDateKeys(rangeStart, rangeEnd).filter(
      (dateKey) => dateKey >= todayDateKey || eventsByDate.has(dateKey)
    ),
    [eventsByDate, rangeEnd, rangeStart, todayDateKey]
  );

  useEffect(() => {
    if (didInitialScrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const today = todayRef.current;
      if (!viewport || !today) return;

      viewport.scrollTo({
        left: Math.max(0, today.offsetLeft - (viewport.clientWidth - today.clientWidth) / 2),
        behavior: "auto"
      });
      didInitialScrollRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
      if (suppressClickFrameRef.current !== null) {
        window.cancelAnimationFrame(suppressClickFrameRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const pending = pendingPrependRef.current;
    const viewport = viewportRef.current;
    if (!pending || !viewport) return;

    const addedWidth = viewport.scrollWidth - pending.scrollWidth;
    viewport.scrollLeft = pending.scrollLeft + addedWidth;
    if (mouseDragRef.current) {
      mouseDragRef.current.startScrollLeft += addedWidth;
    }
    pendingPrependRef.current = null;
  }, [rangeStart]);

  async function loadMoreDates(direction: -1 | 1) {
    if (loadInProgressRef.current) return;

    let from: string;
    let through: string;
    try {
      if (direction < 0) {
        through = addDaysToDateKey(rangeStart, -1);
        from = addDaysToDateKey(through, -(ROADMAP_PAGE_DAYS - 1));
      } else {
        from = addDaysToDateKey(rangeEnd, 1);
        through = addDaysToDateKey(from, ROADMAP_PAGE_DAYS - 1);
      }
    } catch {
      return;
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;
    loadInProgressRef.current = true;

    try {
      const response = await fetch(
        `/api/roadmap-events?from=${encodeURIComponent(from)}&through=${encodeURIComponent(through)}`,
        {
          cache: "no-store",
          signal: controller.signal
        }
      );
      if (!response.ok) throw new Error(`Roadmap request failed (${response.status})`);

      const body = await response.json() as { events?: RoadmapEvent[] };
      if (!Array.isArray(body.events)) throw new Error("Roadmap response is invalid");

      if (direction < 0) {
        const viewport = viewportRef.current;
        if (viewport) {
          pendingPrependRef.current = {
            scrollLeft: viewport.scrollLeft,
            scrollWidth: viewport.scrollWidth
          };
        }
      }

      setTimelineEvents((current) => {
        const merged = new Map(current.map((event) => [event.id, event]));
        for (const event of body.events ?? []) merged.set(event.id, event);
        return sortRoadmapEvents([...merged.values()]);
      });
      if (direction < 0) setRangeStart(from);
      else setRangeEnd(through);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Roadmap window load failed", error);
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        loadInProgressRef.current = false;
      }
    }
  }

  function handleViewportScroll() {
    const viewport = viewportRef.current;
    if (!viewport || loadInProgressRef.current) return;

    if (viewport.scrollLeft <= LOAD_MORE_THRESHOLD_PX) {
      void loadMoreDates(-1);
      return;
    }

    const remaining = viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft;
    if (remaining <= LOAD_MORE_THRESHOLD_PX) {
      void loadMoreDates(1);
    }
  }

  function scrollTimeline(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (direction < 0 && viewport.scrollLeft <= LOAD_MORE_THRESHOLD_PX) {
      void loadMoreDates(-1);
      return;
    }

    viewport.scrollBy({
      left: viewport.clientWidth * 0.72 * direction,
      behavior: timelineScrollBehavior()
    });
  }

  function scrollToToday() {
    const viewport = viewportRef.current;
    const today = todayRef.current;
    if (!viewport || !today) return;

    viewport.scrollTo({
      left: Math.max(0, today.offsetLeft - (viewport.clientWidth - today.clientWidth) / 2),
      behavior: timelineScrollBehavior()
    });
    viewport.focus({ preventScroll: true });
  }

  function handleViewportKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollTimeline(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollTimeline(1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      scrollToToday();
    }
  }

  function clearSuppressedClick() {
    suppressClickRef.current = false;
    if (suppressClickFrameRef.current !== null) {
      window.cancelAnimationFrame(suppressClickFrameRef.current);
      suppressClickFrameRef.current = null;
    }
  }

  function suppressDragClick() {
    clearSuppressedClick();
    suppressClickRef.current = true;
    suppressClickFrameRef.current = window.requestAnimationFrame(() => {
      suppressClickRef.current = false;
      suppressClickFrameRef.current = null;
    });
  }

  function releaseMousePointer(captureTarget: Element, pointerId: number) {
    if (captureTarget.hasPointerCapture(pointerId)) {
      captureTarget.releasePointerCapture(pointerId);
    }
  }

  function handleViewportPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary) return;

    clearSuppressedClick();
    const captureTarget = event.target as Element;
    mouseDragRef.current = {
      pointerId: event.pointerId,
      captureTarget,
      startClientX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      didDrag: false
    };
    captureTarget.setPointerCapture(event.pointerId);
  }

  function handleViewportPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = mouseDragRef.current;
    if (event.pointerType !== "mouse" || !drag || drag.pointerId !== event.pointerId) return;

    const distanceX = event.clientX - drag.startClientX;
    if (!drag.didDrag && Math.abs(distanceX) <= MOUSE_DRAG_THRESHOLD_PX) return;

    if (!drag.didDrag) {
      drag.didDrag = true;
      setIsDragging(true);
    }

    event.preventDefault();
    const nextScrollLeft = drag.startScrollLeft - distanceX;
    event.currentTarget.scrollLeft = nextScrollLeft;
    if (nextScrollLeft <= 0 && !loadInProgressRef.current) {
      void loadMoreDates(-1);
    }
  }

  function handleViewportPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = mouseDragRef.current;
    if (event.pointerType !== "mouse" || !drag || drag.pointerId !== event.pointerId) return;

    if (drag.didDrag) suppressDragClick();
    mouseDragRef.current = null;
    setIsDragging(false);
    releaseMousePointer(drag.captureTarget, event.pointerId);
  }

  function handleViewportPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = mouseDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    mouseDragRef.current = null;
    setIsDragging(false);
    releaseMousePointer(drag.captureTarget, event.pointerId);
  }

  function handleViewportLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = mouseDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    mouseDragRef.current = null;
    setIsDragging(false);
  }

  function handleViewportClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    clearSuppressedClick();
  }

  function toggleDate(dateKey: string) {
    setExpandedDateKeys((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  return (
    <section className="roadmap-board" aria-labelledby="roadmap-board-title">
      <div className="roadmap-board-heading">
        <div>
          <p className="roadmap-eyebrow">공시 기반 일정</p>
          <h2 id="roadmap-board-title">한눈에 보는 운용 계획</h2>
        </div>
      </div>

      <div className="roadmap-toolbar">
        <div className="roadmap-filter-list" role="group" aria-label="로드맵 상태 필터">
          {ROADMAP_FILTERS.map((filter) => {
            const isActive = activeFilter === filter.id;
            const count = filterCount(timelineEvents, filter.id);

            return (
              <button
                key={filter.id}
                className={`roadmap-filter roadmap-filter--${filter.id.toLowerCase()}${isActive ? " is-active" : ""}`}
                type="button"
                aria-pressed={isActive}
                aria-label={`${filter.label} 일정 ${count}개`}
                onClick={() => setActiveFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <span className="roadmap-filter-count" aria-hidden="true">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="roadmap-navigation" role="group" aria-label="로드맵 날짜 이동">
          <button
            className="roadmap-navigation-button"
            type="button"
            onClick={() => scrollTimeline(-1)}
            aria-label="이전 날짜 보기"
          >
            <ChevronLeft size={17} aria-hidden="true" />
            <span>이전</span>
          </button>
          <button className="roadmap-today-button" type="button" onClick={scrollToToday}>
            <LocateFixed size={16} aria-hidden="true" />
            <span>오늘</span>
          </button>
          <button
            className="roadmap-navigation-button"
            type="button"
            onClick={() => scrollTimeline(1)}
            aria-label="다음 날짜 보기"
          >
            <span>다음</span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      {visibleEvents.length === 0 ? (
        <p className="roadmap-empty-message">선택한 상태의 일정이 없습니다.</p>
      ) : null}

      <div
        className={`roadmap-viewport${isDragging ? " is-dragging" : ""}`}
        ref={viewportRef}
        tabIndex={0}
        onScroll={handleViewportScroll}
        onKeyDown={handleViewportKeyDown}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerUp}
        onPointerCancel={handleViewportPointerCancel}
        onLostPointerCapture={handleViewportLostPointerCapture}
        onClickCapture={handleViewportClickCapture}
        onDragStart={(event) => event.preventDefault()}
        aria-label="운용 로드맵"
      >
        <ol className="roadmap-track">
          {dateKeys.map((dateKey) => {
            const dateEvents = eventsByDate.get(dateKey) ?? [];
            const isExpanded = expandedDateKeys.has(dateKey);
            const displayedEvents = isExpanded
              ? dateEvents
              : dateEvents.slice(0, COLLAPSED_EVENTS_PER_DATE);
            const hiddenEventCount = dateEvents.length - displayedEvents.length;
            const isToday = dateKey === todayDateKey;
            const isPast = dateKey < todayDateKey;
            const stopClassName = [
              "roadmap-stop",
              isToday && "is-today",
              isPast && "is-past",
              dateEvents.length > 0 ? "has-events" : "is-empty"
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li
                className={stopClassName}
                key={dateKey}
                ref={isToday ? todayRef : undefined}
                data-date-key={dateKey}
              >
                <div
                  className={[
                    "roadmap-pin-stack",
                    dateEvents.length === 0 && "roadmap-pin-stack--empty",
                    dateEvents.length > COLLAPSED_EVENTS_PER_DATE && "roadmap-pin-stack--condensed",
                    isExpanded && "roadmap-pin-stack--expanded"
                  ].filter(Boolean).join(" ")}
                  role={dateEvents.length > 0 ? "group" : undefined}
                  aria-label={dateEvents.length > 0 ? `${roadmapDateLabel(dateKey)} 일정 ${dateEvents.length}개` : undefined}
                  aria-hidden={dateEvents.length === 0 ? "true" : undefined}
                >
                  {displayedEvents.map((event) => {
                    const eventTitle = roadmapEventTitle(event);
                    const eventSummary = roadmapEventSummary(event);
                    const kindClass = event.kind.toLowerCase();
                    const categoryClass = event.category.toLowerCase().replaceAll("_", "-");

                    return (
                      <article className={`roadmap-pin roadmap-pin--${kindClass}`} key={event.id}>
                        <Link
                          className="roadmap-pin-link"
                          href={`/disclosures/${event.disclosureId}`}
                          draggable={false}
                          aria-label={`${roadmapCategoryLabel(event.category)} ${roadmapKindLabel(event.kind)} 일정, ${eventTitle} 공시 보기`}
                        >
                          <span className="roadmap-pin-meta">
                            <span className={`roadmap-category roadmap-category--${categoryClass}`}>
                              {roadmapCategoryLabel(event.category)}
                            </span>
                            <span className={`roadmap-kind roadmap-kind--${kindClass}`}>
                              {roadmapKindLabel(event.kind)}
                            </span>
                          </span>
                          <span className="roadmap-pin-title-row">
                            <strong className="roadmap-pin-title">{eventTitle}</strong>
                            <ArrowUpRight className="roadmap-pin-arrow" size={16} aria-hidden="true" />
                          </span>
                          {eventSummary ? <span className="roadmap-pin-summary">{eventSummary}</span> : null}
                        </Link>
                      </article>
                    );
                  })}
                  {dateEvents.length > COLLAPSED_EVENTS_PER_DATE ? (
                    <button
                      className="roadmap-pin-more"
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleDate(dateKey)}
                    >
                      {isExpanded ? "접기" : `${hiddenEventCount}개 더 보기`}
                    </button>
                  ) : null}
                </div>

                <span className="roadmap-node" aria-hidden="true">
                  <span className="roadmap-node-core" />
                </span>

                <time className="roadmap-date" dateTime={dateKey} aria-current={isToday ? "date" : undefined}>
                  <span className="roadmap-date-main">{roadmapDateLabel(dateKey)}</span>
                  <span className="roadmap-date-weekday">{roadmapWeekdayLabel(dateKey)}</span>
                  {isToday ? <span className="roadmap-today-label">오늘</span> : null}
                </time>
              </li>
            );
          })}
        </ol>
      </div>

    </section>
  );
}
