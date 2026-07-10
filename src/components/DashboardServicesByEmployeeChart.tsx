"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

interface EmployeeServiceItem {
  employeeId: number | null;
  employeeName: string;
  count: number;
}

interface DashboardServicesByEmployeeChartProps {
  servicesByEmployee: EmployeeServiceItem[];
}

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: "12px",
};

export default function DashboardServicesByEmployeeChart({
  servicesByEmployee,
}: DashboardServicesByEmployeeChartProps) {
  const hasData = servicesByEmployee.length > 0 && !servicesByEmployee.every((s) => s.count === 0);

  return (
    <div className="card p-5">
      <div className="section-header mb-4">
        <span className="section-accent" />
        <h2 className="section-title">Servicios por Empleada</h2>
        <span className="text-[10px] text-muted font-medium ml-auto px-2 py-0.5 rounded-full bg-surface border border-border">
          Esta semana
        </span>
      </div>
      {!hasData ? (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary-bg flex items-center justify-center">
            <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted">Sin servicios esta semana</p>
          <p className="text-xs text-muted/60 mt-1">Completa citas para ver los resultados aquí</p>
        </div>
      ) : (
        <div className="mt-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={servicesByEmployee}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="employeeName"
                tick={{ fontSize: 12, fill: "#334155" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [value, "Servicios"]}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={48}>
                {servicesByEmployee.map((s) => (
                  <Cell key={`emp-${s.employeeId}`} fill={CHART_COLORS[(s.employeeId ?? 0) % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
