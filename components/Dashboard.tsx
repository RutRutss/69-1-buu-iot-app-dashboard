"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  useSensorData,
  type RangeKey,
  type Reading,
} from "@/lib/sensor-data";
import { METRICS } from "./metrics";
import { ReadingsTable } from "./ReadingsTable";
import {
  SensorChart,
  formatDateTime,
  formatValue,
  type Metric,
} from "./SensorChart";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "day", label: "วันนี้" },
  { key: "month", label: "เดือนนี้" },
  { key: "year", label: "ปีนี้" },
];

// The device logs about every 30 minutes; past this it is considered silent.
const STALE_AFTER_MS = 45 * 60 * 1000;

function range(readings: Reading[], key: Metric["key"]) {
  const values = readings
    .map((r) => r[key])
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function formatAge(ms: number) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

function DeviceStatus({ latest }: { latest: Reading }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const age = Math.max(0, now - latest.t);
  const online = age < STALE_AFTER_MS;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-secondary">
      <span className="flex items-center gap-1.5 font-medium text-ink">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{
            background: online ? "var(--status-good)" : "var(--ink-muted)",
          }}
        />
        {online ? "ออนไลน์" : "ไม่มีข้อมูลใหม่"}
      </span>
      <span>
        ค่าล่าสุด {formatDateTime(latest.t)} ({formatAge(age)})
      </span>
    </p>
  );
}

export function Dashboard() {
  const [selected, setSelected] = useState<RangeKey>("day");
  const { readings, error, loading, loadedRange, truncated } =
    useSensorData(selected);
  const latest = readings.at(-1);
  const selectedIndex = RANGES.findIndex((r) => r.key === selected);
  const selectedLabel = RANGES[selectedIndex].label;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            IoT Dashboard
          </h1>
          {latest ? (
            <DeviceStatus latest={latest} />
          ) : (
            <p className="text-sm text-ink-secondary">
              ข้อมูลเซนเซอร์แบบเรียลไทม์จาก Firestore
            </p>
          )}
        </div>

        <div
          role="group"
          aria-label="ช่วงเวลาที่แสดง"
          className="glass relative grid grid-cols-3 rounded-xl p-1 text-sm"
        >
          {/* Sliding highlight behind the selected option. */}
          <span
            aria-hidden
            className="absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-ink shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${selectedIndex * 100}%)` }}
          />
          {RANGES.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={option.key === selected}
              onClick={() => setSelected(option.key)}
              className={`relative rounded-lg px-4 py-1.5 transition-colors duration-300 active:scale-95 ${
                option.key === selected
                  ? "text-ink-inverse"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p role="alert" className="glass rounded-2xl p-6 text-sm text-ink">
          {error}
        </p>
      ) : loadedRange === null ? (
        <p className="glass rounded-2xl p-6 text-sm text-ink-secondary">
          กำลังโหลดข้อมูล…
        </p>
      ) : (
        // Keyed by the loaded range so the entrance animation replays when
        // the filter changes, but not on live updates.
        <div
          key={loadedRange}
          aria-busy={loading}
          className={`flex flex-col gap-6 transition-opacity duration-300 ${
            loading ? "opacity-50" : ""
          }`}
        >
          {!latest ? (
            <p className="glass animate-rise rounded-2xl p-6 text-sm text-ink-secondary">
              ยังไม่มีข้อมูลในช่วง{selectedLabel}
            </p>
          ) : (
            <>
              <section className="grid gap-4 lg:grid-cols-3">
                {METRICS.map((metric, i) => {
                  const extent = range(readings, metric.key);
                  return (
                    <article
                      key={metric.key}
                      style={stagger(i)}
                      className="glass animate-rise flex flex-col gap-4 rounded-2xl p-5"
                    >
                      <div className="flex flex-col gap-1">
                        <h2 className="flex items-center gap-2 text-sm text-ink-secondary">
                          <span
                            aria-hidden
                            className="h-2 w-2 rounded-full"
                            style={{ background: metric.color }}
                          />
                          {metric.label}
                        </h2>
                        <p className="text-4xl font-semibold tracking-tight text-ink">
                          {formatValue(latest[metric.key], metric)}
                          {metric.unit && (
                            <span className="ml-1 text-lg font-normal text-ink-secondary">
                              {metric.unit}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {extent
                            ? `ต่ำสุด ${formatValue(extent.min, metric)} · สูงสุด ${formatValue(extent.max, metric)}`
                            : "ไม่มีข้อมูลในช่วงนี้"}
                        </p>
                      </div>
                      <SensorChart data={readings} metric={metric} />
                    </article>
                  );
                })}
              </section>

              <ReadingsTable
                readings={readings}
                rangeLabel={selectedLabel}
                truncated={truncated}
                style={stagger(METRICS.length)}
              />
            </>
          )}
        </div>
      )}
    </main>
  );
}
