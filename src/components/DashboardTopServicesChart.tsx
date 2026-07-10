"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

interface TopServiceItem {
  id: number;
  name: string;
  category: string;
  count: number;
}

interface DashboardTopServicesChartProps {
  topServices: TopServiceItem[];
}

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: "12px",
};

export default function DashboardTopServicesChart({ topServices }: DashboardTopServicesChartProps) {
  return (
    <div className="card p-5">
      <div className="section-header mb-4">
        <span className="section-accent" />
        <h2 className="section-title">Servicios Más Populares</h2>
        <span className="text-[10px] text-muted font-medium ml-auto px-2 py-0.5 rounded-full bg-surface border border-border">
          Por reservas
        </span>
      </div>
      {topServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-violet-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted">Sin reservas aún</p>
          <p className="text-xs text-muted/60 mt-1">Los servicios más reservados aparecerán aquí</p>
        </div>
      ) : (
        <div className="mt-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={topServices}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#334155" }}
                tickLine={false}
                axisLine={false}
                width={160}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [value, "Reservas"]}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                {topServices.map((s) => (
                  <Cell key={`ts-${s.id}`} fill={CHART_COLORS[s.id % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
