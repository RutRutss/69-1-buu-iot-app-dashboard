import type { Metric } from "./SensorChart";

export const METRICS: Metric[] = [
  {
    key: "temperature",
    label: "อุณหภูมิ",
    unit: "°C",
    color: "var(--series-temperature)",
    digits: 1,
  },
  {
    key: "airHumidity",
    label: "ความชื้นอากาศ",
    unit: "%",
    color: "var(--series-humidity)",
    digits: 1,
  },
  {
    key: "soilMoisture",
    label: "ความชื้นดิน",
    unit: "%",
    color: "var(--series-soil)",
    digits: 0,
  },
];

// Normal operating band per metric; a reading outside it is flagged in the
// table with the matching label.
export const LIMITS: Record<
  Metric["key"],
  { min: number; max: number; low: string; high: string }
> = {
  temperature: { min: 18, max: 35, low: "เย็นเกิน", high: "ร้อนเกิน" },
  airHumidity: { min: 40, max: 85, low: "อากาศแห้งเกิน", high: "อากาศชื้นเกิน" },
  soilMoisture: { min: 20, max: 80, low: "ดินแห้งเกิน", high: "ดินแฉะเกิน" },
};

export type Level = "low" | "high";

export function levelOf(value: number | null, key: Metric["key"]): Level | null {
  if (value === null) return null;
  if (value < LIMITS[key].min) return "low";
  if (value > LIMITS[key].max) return "high";
  return null;
}

export const LEVEL_STYLE = {
  low: { tint: "var(--status-low-tint)", color: "var(--status-low)", icon: "▼" },
  high: {
    tint: "var(--status-high-tint)",
    color: "var(--status-high)",
    icon: "▲",
  },
};
