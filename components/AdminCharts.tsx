"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ReactNode } from "react";

const formatChartDate = (value: string, includeYear = false) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(value));

export function TrendStatCard({
  icon,
  iconClass,
  label,
  value,
  note,
  trend,
  delta,
  color,
}: {
  icon: ReactNode;
  iconClass: string;
  label: string;
  value: string | number;
  note: string;
  trend: { day: string; value: number }[];
  delta?: number;
  color: string;
}) {
  return (
    <div className="stat-card trend-stat-card">
      <div className="trend-stat-top">
        <div className={`mini-icon ${iconClass}`}>{icon}</div>
        {delta !== undefined && (
          <span className={`trend-delta ${delta >= 0 ? "is-up" : "is-down"}`}>
            {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <span className="trend-stat-label">{label}</span>
      <strong className="trend-stat-value">{value}</strong>
      <div className="trend-stat-bottom">
        <small>{note}</small>
        <Sparkline data={trend} color={color} />
      </div>
    </div>
  );
}

export function Sparkline({ data, color }: { data: { day: string; value: number }[]; color: string }) {
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendAreaChart({ data, label, suffix = "" }: { data: { day: string; value: number }[]; label: string; suffix?: string }) {
  return (
    <div className="chart-area">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="day" tickFormatter={(value) => formatChartDate(value)} tick={{ fontSize: 11, fill: "#8699a0" }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis tick={{ fontSize: 11, fill: "#8699a0" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [`${value}${suffix}`, label]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(value: any) => formatChartDate(value, true)}
            contentStyle={{ borderRadius: 12, border: "1px solid #dfe9e5", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} fill="url(#trend-fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({ segments, centerLabel, centerValue }: { segments: { label: string; value: number; color: string; chart?: boolean }[]; centerLabel: string; centerValue: number | string }) {
  // Supplemental states such as Late and Work from home can overlap with
  // Present, but are intentionally included so the ring visualizes the full
  // mix of today's attendance signals.
  const chartSegments = segments;
  const total = typeof centerValue === "number" ? centerValue : chartSegments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div className="status-donut-row">
      <div className="status-donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartSegments} dataKey="value" nameKey="label" innerRadius="72%" outerRadius="100%" paddingAngle={total ? 2 : 0} startAngle={90} endAngle={-270}>
              {chartSegments.map((segment) => (
                <Cell key={segment.label} fill={segment.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="status-donut-center">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="status-donut-legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <i style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <strong>{segment.value}{total ? ` (${Math.round((segment.value / total) * 100)}%)` : ""}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HealthDonut({ overall, metrics }: { overall: number; metrics: { label: string; value: number; color: string }[] }) {
  const ringData = [{ value: overall }, { value: 100 - overall }];
  return (
    <div className="health-donut-row">
      <div className="status-donut-chart health-ring">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={ringData} dataKey="value" innerRadius="74%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="none">
              <Cell fill="var(--primary)" />
              <Cell fill="var(--line)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="status-donut-center">
          <strong>{overall}%</strong>
          <span>Attendance health</span>
        </div>
      </div>
      <div className="health-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="health-metric-row">
            <span>{metric.label}</span>
            <div className="health-metric-bar"><i style={{ width: `${metric.value}%`, background: metric.color }} /></div>
            <strong>{metric.value}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AttendanceHeatmap({ grid, weekLabels, maxCount }: { grid: { date: string; count: number; future: boolean }[][]; weekLabels: string[]; maxCount: number }) {
  const intensity = (count: number) => {
    if (!count) return 0;
    const ratio = maxCount ? count / maxCount : 0;
    if (ratio > 0.66) return 3;
    if (ratio > 0.33) return 2;
    return 1;
  };
  return (
    <div className="heatmap">
      <div className="heatmap-grid">
        <div className="heatmap-weekdays">
          {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="heatmap-columns">
          {weekLabels.map((week, weekIndex) => (
            <div className="heatmap-column" key={week}>
              {grid.map((row, weekdayIndex) => {
                const cell = row[weekIndex];
                if (!cell || cell.future) return <span key={weekdayIndex} className="heatmap-cell heatmap-cell-empty" />;
                return (
                  <span
                    key={weekdayIndex}
                    className={`heatmap-cell heatmap-level-${intensity(cell.count)}`}
                    title={`${formatChartDate(cell.date)}: ${cell.count} check-in${cell.count === 1 ? "" : "s"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="heatmap-axis">
        {weekLabels.filter((_, index) => index % 2 === 0).map((week) => (
          <span key={week}>{formatChartDate(week)}</span>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>No check-ins</span>
        <i className="heatmap-level-0" />
        <i className="heatmap-level-1" />
        <i className="heatmap-level-2" />
        <i className="heatmap-level-3" />
        <span>High</span>
      </div>
    </div>
  );
}

export function TopEmployeesList({ items }: { items: { employee: { firstName: string; lastName: string; jobTitle?: string }; hours: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.hours));
  if (!items.length) return <p className="panel-message">No completed sessions in this period yet.</p>;
  return (
    <ol className="top-employees-list">
      {items.map((item, index) => (
        <li key={`${item.employee.firstName}-${item.employee.lastName}-${index}`}>
          <span className="top-employees-rank">{index + 1}</span>
          <div className="avatar">{item.employee.firstName[0]}{item.employee.lastName[0]}</div>
          <div className="top-employees-copy">
            <strong>{item.employee.firstName} {item.employee.lastName}</strong>
            <span>{item.employee.jobTitle || "Employee"}</span>
          </div>
          <div className="top-employees-bar"><i style={{ width: `${(item.hours / max) * 100}%` }} /></div>
          <strong className="top-employees-hours">{item.hours}h</strong>
        </li>
      ))}
    </ol>
  );
}

export function DepartmentBars({ data }: { data: { name: string; hours: number }[] }) {
  if (!data.length) return <p className="panel-message">No completed sessions in this period yet.</p>;
  const max = Math.max(1, ...data.map((item) => item.hours));
  const total = data.reduce((sum, item) => sum + item.hours, 0);
  return (
    <div className="hours-breakdown">
      <div className="hours-breakdown-total"><span>Completed time</span><strong>{total}h</strong></div>
      <div className="hours-breakdown-list">
        {data.map((item, index) => (
          <div className="hours-breakdown-row" key={item.name}>
            <span className="hours-rank">{index + 1}</span>
            <strong title={item.name}>{item.name}</strong>
            <div className="hours-track" aria-label={`${item.name}: ${item.hours} hours`}><i style={{ width: `${Math.max(5, (item.hours / max) * 100)}%` }} /></div>
            <b>{item.hours}h</b>
          </div>
        ))}
      </div>
    </div>
  );
}
