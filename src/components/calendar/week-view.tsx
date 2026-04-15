"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { EventBlock, type CalendarEvent } from "./event-block";

// ── Types ────────────────────────────────────────────────────────────
export interface WeekViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  startHour?: number; // default 7 (7 AM)
  endHour?: number;   // default 22 (10 PM)
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Get the Monday of the week containing `date` */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Return the 7 day Date objects for the week starting `monday` */
function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** Convert event into { topPct, heightPct } within the visible hour range */
function eventPosition(
  event: CalendarEvent,
  startHour: number,
  endHour: number,
): { topPct: number; heightPct: number } {
  const totalHours = endHour - startHour;
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + 60 * 60 * 1000);

  const startDecimalHour = start.getHours() + start.getMinutes() / 60;
  const endDecimalHour = end.getHours() + end.getMinutes() / 60;

  const clampedStart = Math.max(startHour, Math.min(endHour, startDecimalHour));
  const clampedEnd = Math.max(startHour, Math.min(endHour, endDecimalHour));

  const topPct = ((clampedStart - startHour) / totalHours) * 100;
  const heightPct = ((clampedEnd - clampedStart) / totalHours) * 100;

  return { topPct, heightPct: Math.max(heightPct, 2) };
}

// ── Component ────────────────────────────────────────────────────────
export function WeekView({
  events,
  onEventClick,
  startHour = 7,
  endHour = 22,
  className,
}: WeekViewProps) {
  const today = new Date();
  const [weekStart, setWeekStart] = React.useState<Date>(() => getWeekStart(today));
  const weekDays = getWeekDays(weekStart);

  // Build hour labels
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const totalHours = endHour - startHour;

  // Navigate weeks
  const prevWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };
  const nextWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };
  const goToday = () => setWeekStart(getWeekStart(today));

  // Group events by day index (0=Mon, 6=Sun)
  const eventsByDay = React.useMemo<Record<number, CalendarEvent[]>>(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    for (const ev of events) {
      const evDate = new Date(ev.start);
      for (let i = 0; i < 7; i++) {
        if (isSameDay(evDate, weekDays[i])) {
          map[i].push(ev);
          break;
        }
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, weekStart]);

  // Current time indicator
  const nowLineTop = React.useMemo(() => {
    const h = today.getHours() + today.getMinutes() / 60;
    if (h < startHour || h > endHour) return null;
    return ((h - startHour) / totalHours) * 100;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCurrentWeek = isSameDay(weekStart, getWeekStart(today));

  return (
    <div
      className={cn("flex flex-col gap-0", className)}
      style={{
        background: "linear-gradient(180deg, rgba(30,30,52,0.97), rgba(26,26,46,0.98))",
        border: "1px solid rgba(0,212,255,0.12)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* ── Week navigation header ───────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-wrap"
        style={{ borderColor: "rgba(0,212,255,0.12)" }}
      >
        <h3 className="text-[0.8rem] font-bold uppercase tracking-wider" style={{ color: "#00d4ff", margin: 0 }}>
          Week of{" "}
          {weekStart.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-1.5 ml-auto">
          <NavBtn onClick={prevWeek}>‹ Prev</NavBtn>
          <NavBtn onClick={goToday} active={isCurrentWeek}>Today</NavBtn>
          <NavBtn onClick={nextWeek}>Next ›</NavBtn>
        </div>
      </div>

      {/* ── Grid: time column + 7 day columns ───────────────────── */}
      <div className="overflow-x-auto">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "48px repeat(7, minmax(80px, 1fr))",
            minWidth: 600,
          }}
        >
          {/* ── Day header row ───────────────────────────────── */}
          {/* Empty corner */}
          <div
            className="border-b border-r"
            style={{
              borderColor: "rgba(0,212,255,0.12)",
              background: "rgba(26,26,46,0.6)",
              height: 52,
            }}
          />
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={i}
                className="flex flex-col items-center justify-center border-b border-r py-1"
                style={{
                  borderColor: "rgba(0,212,255,0.12)",
                  background: isToday ? "rgba(9,132,227,0.06)" : "rgba(26,26,46,0.6)",
                  height: 52,
                }}
              >
                <span
                  className="text-[0.65rem] font-semibold uppercase tracking-wide"
                  style={{ color: isToday ? "#77adff" : "#6880a8" }}
                >
                  {DAY_LABELS[i]}
                </span>
                <span
                  className="text-[0.82rem] font-bold mt-0.5"
                  style={{ color: isToday ? "#77adff" : "#b6c9ea" }}
                >
                  {day.getDate()}
                </span>
                {isToday && (
                  <span
                    className="h-1 w-1 rounded-full mt-0.5"
                    style={{ background: "#77adff" }}
                  />
                )}
              </div>
            );
          })}

          {/* ── Hour rows ────────────────────────────────────── */}
          {hours.map((hour) => (
            <React.Fragment key={hour}>
              {/* Time label */}
              <div
                className="border-b border-r flex items-start justify-end pr-1.5 pt-1"
                style={{
                  borderColor: "rgba(0,212,255,0.09)",
                  background: "rgba(26,26,46,0.6)",
                  height: 56,
                }}
              >
                <span className="text-[0.58rem] font-medium" style={{ color: "#5e7299" }}>
                  {formatHour(hour)}
                </span>
              </div>

              {/* Day cells */}
              {weekDays.map((day, dayIdx) => {
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={dayIdx}
                    className="border-b border-r relative"
                    style={{
                      borderColor: "rgba(0,212,255,0.08)",
                      background: isToday ? "rgba(9,132,227,0.03)" : "transparent",
                      height: 56,
                    }}
                  />
                );
              })}
            </React.Fragment>
          ))}

          {/* ── Event overlay: rendered once per day column ────── */}
          {/* We do this via absolute positioning inside a second pass */}
        </div>

        {/* ── Events overlay (positioned absolutely over the grid body) ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "48px repeat(7, minmax(80px, 1fr))",
            minWidth: 600,
            position: "relative",
            marginTop: `calc(-${hours.length * 56}px)`, // overlay on top of the hour rows
            height: `${hours.length * 56}px`,
            pointerEvents: "none",
          }}
        >
          {/* Skip time column */}
          <div />

          {weekDays.map((_, dayIdx) => {
            const dayEvents = eventsByDay[dayIdx] ?? [];
            const isToday = isSameDay(weekDays[dayIdx], today);

            return (
              <div
                key={dayIdx}
                className="relative border-r"
                style={{
                  borderColor: "rgba(0,212,255,0.08)",
                  height: `${hours.length * 56}px`,
                  pointerEvents: "auto",
                }}
              >
                {/* Now line */}
                {isToday && nowLineTop !== null && (
                  <div
                    className="absolute left-0 right-0 z-30 pointer-events-none"
                    style={{ top: `${nowLineTop}%` }}
                  >
                    <div
                      style={{
                        height: 2,
                        background: "linear-gradient(90deg, rgba(0,212,255,0.9), transparent)",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: -4,
                          top: -3,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#77adff",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const { topPct, heightPct } = eventPosition(ev, startHour, endHour);
                  return (
                    <EventBlock
                      key={ev.id}
                      event={ev}
                      topPct={topPct}
                      heightPct={heightPct}
                      onClick={onEventClick}
                    />
                  );
                })}

                {/* Empty day placeholder */}
                {dayEvents.length === 0 && (
                  <div
                    className="flex items-center justify-center h-full"
                    style={{ color: "#2e3e5c", fontSize: "0.6rem", userSelect: "none" }}
                  >
                    —
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 border-t flex-wrap"
        style={{ borderColor: "rgba(0,212,255,0.12)" }}
      >
        <span className="text-[0.65rem]" style={{ color: "#5e7299" }}>Calendars:</span>
        {[
          { label: "Work", color: "#77adff" },
          { label: "Personal", color: "#a78bfa" },
          { label: "Apple", color: "#fbbf24" },
          { label: "Cron", color: "#7fe1b8" },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1 text-[0.65rem]" style={{ color: "#475569" }}>
            <span className="h-2 w-2 rounded-sm" style={{ background: color, opacity: 0.8 }} />
            {label}
          </span>
        ))}
        <span className="text-[0.62rem] ml-auto" style={{ color: "#3d5070" }}>
          {startHour}:00 – {endHour}:00
        </span>
      </div>
    </div>
  );
}

// ── Nav button ───────────────────────────────────────────────────────
function NavBtn({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[0.7rem] font-semibold rounded-lg px-3 py-1.5 transition-colors duration-150"
      style={{
        background: active ? "rgba(0,212,255,0.1)" : "rgba(8,12,30,0.55)",
        border: active ? "1px solid rgba(0,212,255,0.35)" : "1px solid rgba(0,212,255,0.12)",
        color: active ? "#77adff" : "#94a3b8",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
