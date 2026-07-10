"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

interface WeeklyServiceItem {
  serviceId: number;
  serviceName: string;
  category: string;
  count: number;
}

interface DashboardWeeklyServicesChartProps {
  weeklyServices: WeeklyServiceItem[];
}

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: "12px",
};

export default function DashboardWeeklyServicesChart({ weeklyServices }: DashboardWeeklyServicesChartProps) {
  return (
    <div className="card p-5">
      <div className="section-header mb-4">
        <span className="section-accent" />
        <h2 className="section-title">Servicios de la Semana</h2>
        <span className="text-[10px] text-muted font-medium ml-auto px-2 py-0.5 rounded-full bg-surface border border-border">
          Esta semana
        </span>
      </div>
      {!weeklyServices || weeklyServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-rose-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted">Sin servicios esta semana</p>
          <p className="text-xs text-muted/60 mt-1">Los servicios realizados esta semana aparecerán aquí al completar citas</p>
        </div>
      ) : (
        <div className="mt-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={weeklyServices}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="serviceName"
                tick={{ fontSize: 9, fill: "#334155" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string, props: any) => [
                  value,
                  props.payload.category ? `${props.payload.category}` : "Servicios",
                ]}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={24}>
                {weeklyServices.map((s) => (
                  <Cell key={`ws-${s.serviceId}`} fill={CHART_COLORS[s.serviceId % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {weeklyServices.map((s, idx) => (
              <span
                key={`badge-${s.serviceId ?? idx}`}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: CHART_COLORS[(s.serviceId ?? 0) % CHART_COLORS.length] + "12",
                  color: CHART_COLORS[(s.serviceId ?? 0) % CHART_COLORS.length],
                }}
              >
                <span className="font-bold">{s.count}</span>
                {s.serviceName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
