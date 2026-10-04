"use client";

import { Fragment, useState, type CSSProperties } from "react";
import type { Reading } from "@/lib/sensor-data";
import { LEVEL_STYLE, LIMITS, METRICS, levelOf, type Level } from "./metrics";
import { formatDateTime, formatValue, type Metric } from "./SensorChart";

type Issue = { key: Metric["key"]; level: Level };

type SortKey = "t" | Metric["key"];

const PAGE_SIZES = [10, 25, 50, 100];

// Status filter values: "all", "normal", "abnormal", or one specific issue
// encoded as `<metric>:<level>`.
const ISSUE_OPTIONS = METRICS.flatMap((metric) =>
  (["high", "low"] as const).map((level) => ({
    value: `${metric.key}:${level}`,
    label: LIMITS[metric.key][level],
  })),
);

function issuesOf(reading: Reading): Issue[] {
  return METRICS.flatMap((metric) => {
    // Judge the value as displayed, so a shown "20" is never flagged as
    // below a limit of 20.
    const value = reading[metric.key];
    const shown = value === null ? null : Number(value.toFixed(metric.digits));
    const level = levelOf(shown, metric.key);
    return level ? [{ key: metric.key, level }] : [];
  });
}

// Local calendar day, matching how times are displayed in the table.
function dayOf(t: number) {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function StatusBadges({ issues }: { issues: Issue[] }) {
  if (!issues.length) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-ink"
        style={{ background: "var(--status-good-tint)" }}
      >
        <span aria-hidden style={{ color: "var(--status-good)" }}>
          ✓
        </span>
        ปกติ
      </span>
    );
  }

  return (
    <span className="flex flex-wrap gap-1">
      {issues.map(({ key, level }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs whitespace-nowrap text-ink"
          style={{ background: LEVEL_STYLE[level].tint }}
        >
          <span
            aria-hidden
            className="text-[0.6rem]"
            style={{ color: LEVEL_STYLE[level].color }}
          >
            {LEVEL_STYLE[level].icon}
          </span>
          {LIMITS[key][level]}
        </span>
      ))}
    </span>
  );
}

export function ReadingsTable({
  readings,
  rangeLabel,
  truncated,
  style,
}: {
  readings: Reading[];
  rangeLabel: string;
  truncated: boolean;
  style?: CSSProperties;
}) {
  const [status, setStatus] = useState("all");
  const [day, setDay] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "t",
    dir: "desc",
  });
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);

  const rows = readings.map((reading) => ({
    reading,
    issues: issuesOf(reading),
  }));
  const abnormalCount = rows.filter((row) => row.issues.length).length;

  const filtered = rows.filter(({ reading, issues }) => {
    if (day && dayOf(reading.t) !== day) return false;
    if (status === "all") return true;
    if (status === "normal") return !issues.length;
    if (status === "abnormal") return issues.length > 0;
    return issues.some((issue) => `${issue.key}:${issue.level}` === status);
  });

  const sorted = filtered.toSorted((a, b) => {
    const av = a.reading[sort.key];
    const bv = b.reading[sort.key];
    // Missing values always sink to the bottom.
    if (av === null) return 1;
    if (bv === null) return -1;
    return sort.dir === "asc" ? av - bv : bv - av;
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);
  const filtering = status !== "all" || day !== "";

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );
    setPage(0);
  };

  const sortHeader = (key: SortKey, label: string, align: "left" | "right") => (
    <th
      aria-sort={
        sort.key === key
          ? sort.dir === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={`py-2 font-normal ${align === "right" ? "pl-4 text-right" : "pr-4"}`}
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${
          sort.key === key ? "text-ink" : ""
        }`}
      >
        {label}
        <span aria-hidden className="w-2 text-[0.6rem]">
          {sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );

  return (
    <section style={style} className="glass animate-rise rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm text-ink-secondary">ข้อมูลที่บันทึก</h2>
        <p className="text-xs text-ink-muted">
          {truncated
            ? `เฉพาะ ${readings.length.toLocaleString("th-TH")} ค่าล่าสุดของช่วงนี้`
            : `ทั้งหมด ${readings.length.toLocaleString("th-TH")} ค่าใน${rangeLabel}`}
          {` · ผิดปกติ ${abnormalCount.toLocaleString("th-TH")} ค่า`}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 text-xs text-ink-secondary">
        <label className="flex flex-col gap-1">
          สถานะ
          <select
            className="control"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">ทั้งหมด</option>
            <option value="normal">ปกติ</option>
            <option value="abnormal">ผิดปกติทั้งหมด</option>
            <optgroup label="เฉพาะสาเหตุ">
              {ISSUE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          วันที่
          <input
            type="date"
            className="control"
            value={day}
            min={readings.length ? dayOf(readings[0].t) : undefined}
            max={readings.length ? dayOf(readings[readings.length - 1].t) : undefined}
            onChange={(e) => {
              setDay(e.target.value);
              setPage(0);
            }}
          />
        </label>

        <label className="flex flex-col gap-1">
          แถวต่อหน้า
          <select
            className="control"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {filtering && (
          <button
            type="button"
            className="control"
            onClick={() => {
              setStatus("all");
              setDay("");
              setPage(0);
            }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-ink-muted">
              {sortHeader("t", "เวลา", "left")}
              {METRICS.map((metric) => (
                <Fragment key={metric.key}>
                  {sortHeader(
                    metric.key,
                    `${metric.label}${metric.unit ? ` (${metric.unit})` : ""}`,
                    "right",
                  )}
                </Fragment>
              ))}
              <th className="py-2 pl-6 font-normal">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ reading, issues }) => (
              <tr
                key={reading.id}
                className="border-b border-hairline last:border-0"
              >
                <td className="py-2 pr-4 text-ink-secondary">
                  {formatDateTime(reading.t)}
                </td>
                {METRICS.map((metric) => {
                  const level = issues.find((i) => i.key === metric.key)?.level;
                  return (
                    <td
                      key={metric.key}
                      className="py-1.5 pl-4 text-right text-ink"
                    >
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5"
                        style={
                          level
                            ? { background: LEVEL_STYLE[level].tint }
                            : undefined
                        }
                      >
                        {level && (
                          <span
                            aria-hidden
                            className="text-[0.6rem]"
                            style={{ color: LEVEL_STYLE[level].color }}
                          >
                            {LEVEL_STYLE[level].icon}
                          </span>
                        )}
                        {formatValue(reading[metric.key], metric)}
                      </span>
                    </td>
                  );
                })}
                <td className="py-1.5 pl-6">
                  <StatusBadges issues={issues} />
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td
                  colSpan={METRICS.length + 2}
                  className="py-8 text-center text-ink-muted"
                >
                  ไม่พบข้อมูลตามตัวกรอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <p>
          {sorted.length
            ? `แสดง ${(current * pageSize + 1).toLocaleString("th-TH")}–${(current * pageSize + visible.length).toLocaleString("th-TH")} จาก ${sorted.length.toLocaleString("th-TH")} รายการ`
            : "0 รายการ"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="control"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            ก่อนหน้า
          </button>
          <span>
            หน้า {current + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="control"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            ถัดไป
          </button>
        </div>
      </div>
    </section>
  );
}
