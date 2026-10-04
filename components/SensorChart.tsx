"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Reading } from "@/lib/sensor-data";

export type Metric = {
  key: "temperature" | "airHumidity" | "soilMoisture";
  label: string;
  unit: string;
  color: string;
  digits: number;
};

const timeFormat = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
});

const dayTimeFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
});

const DAY_MS = 24 * 60 * 60 * 1000;

const dateTimeFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatValue(value: number | null, metric: Metric) {
  if (value === null) return "–";
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: metric.digits,
    maximumFractionDigits: metric.digits,
  });
}

export function formatDateTime(t: number) {
  return dateTimeFormat.format(t);
}

type TooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: Reading }>;
  metric: Metric;
};

function ChartTooltip({ active, payload, metric }: TooltipProps) {
  const reading = payload?.[0]?.payload;
  if (!active || !reading) return null;

  return (
    <div className="glass-solid rounded-xl px-3 py-2 text-xs">
      <p className="text-ink-muted">{formatDateTime(reading.t)}</p>
      <p className="mt-1 flex items-center gap-2 text-ink">
        <span
          className="h-0.5 w-3 rounded-full"
          style={{ background: metric.color }}
        />
        <span className="text-sm font-semibold">
          {formatValue(reading[metric.key], metric)}
        </span>
        {metric.unit && <span className="text-ink-secondary">{metric.unit}</span>}
      </p>
    </div>
  );
}

export function SensorChart({
  data,
  metric,
}: {
  data: Reading[];
  metric: Metric;
}) {
  const gradientId = `fill-${metric.key}`;
  // Clock times repeat once the window spans more than a day, so add the date.
  const span = data.length ? data[data.length - 1].t - data[0].t : 0;
  const tickFormat =
    span > 3 * DAY_MS ? dayFormat : span > DAY_MS ? dayTimeFormat : timeFormat;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metric.color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={metric.color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => tickFormat.format(t)}
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--axis)" }}
            minTickGap={32}
          />
          <YAxis
            domain={["auto", "auto"]}
            width={44}
            tickCount={4}
            tickFormatter={(v: number) => v.toLocaleString("th-TH")}
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<ChartTooltip metric={metric} />}
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Area
            dataKey={metric.key}
            type="monotone"
            stroke={metric.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            connectNulls
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
