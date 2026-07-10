"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface MonthlyTrendItem {
  month: string;
  label: string;
  total: number;
  count: number;
}

interface DashboardMonthlyChartProps {
  monthlyTrend: MonthlyTrendItem[];
  showMonths: 6 | 12;
  onToggleMonths: (months: 6 | 12) => void;
  formatter: Intl.NumberFormat;
}

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: "12px",
};

export default function DashboardMonthlyChart({
  monthlyTrend,
  showMonths,
  onToggleMonths,
  formatter,
}: DashboardMonthlyChartProps) {
  const filteredTrend = showMonths === 6 ? monthlyTrend.slice(-6) : monthlyTrend;
  const hasData = monthlyTrend.length > 0 && !monthlyTrend.every((m) => m.total === 0);

  return (
    <div className="card p-5">
      <div className="section-header mb-4">
        <span className="section-accent" />
        <h2 className="section-title">Ingresos Mensuales</h2>
        <div className="ml-auto flex items-center gap-1 p-0.5 bg-surface rounded-lg border border-border">
          <button
            onClick={() => onToggleMonths(6)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
              showMonths === 6
                ? "bg-white text-dark shadow-sm border border-border"
                : "text-muted hover:text-dark"
            }`}
          >
            6 meses
          </button>
          <button
            onClick={() => onToggleMonths(12)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
              showMonths === 12
                ? "bg-white text-dark shadow-sm border border-border"
                : "text-muted hover:text-dark"
            }`}
          >
            12 meses
          </button>
        </div>
      </div>
      {!hasData ? (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary-bg flex items-center justify-center">
            <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted">Sin datos de ingresos</p>
          <p className="text-xs text-muted/60 mt-1">Los ingresos mensuales aparecerán aquí cuando registres ventas</p>
        </div>
      ) : (
        <div className="mt-2">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={filteredTrend}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) =>
                  value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`
                }
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [formatter.format(value), "Ingresos"]}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Line
                name="total"
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
