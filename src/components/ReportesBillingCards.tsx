"use client";

interface BillingPeriod {
  total: number;
  count: number;
}

interface CustomRangePeriod extends BillingPeriod {
  startDate: string;
  endDate: string;
}

interface BillingData {
  allTime: BillingPeriod;
  last3Months: BillingPeriod;
  lastMonth: BillingPeriod;
  lastWeek: BillingPeriod;
  customRange?: CustomRangePeriod;
}

interface PeriodConfig {
  key: keyof BillingData;
  label: string;
  desc: string;
}

const formatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const defaultPeriods: PeriodConfig[] = [
  { key: "allTime", label: "Desde Siempre", desc: "Historial completo de ventas" },
  { key: "last3Months", label: "Últimos 3 Meses", desc: "Trimestre actual" },
  { key: "lastMonth", label: "Último Mes", desc: "Mes en curso" },
  { key: "lastWeek", label: "Última Semana", desc: "Esta semana" },
];

export default function ReportesBillingCards({
  billing,
  periods = defaultPeriods,
}: {
  billing: BillingData;
  periods?: PeriodConfig[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {periods.map((period) => {
        const p = billing[period.key] as BillingPeriod | undefined;
        if (!p) return null;
        return (
          <div key={period.key} className="card-hover p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-bg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-dark">{period.label}</p>
                  <p className="text-xs text-muted">{period.desc}</p>
                </div>
              </div>
            </div>
            <p className="text-2xl font-bold text-dark">{formatter.format(p.total)}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted bg-surface px-2 py-1 rounded-full border border-border">
                {p.count} {p.count === 1 ? "venta" : "ventas"}
              </span>
              {p.count > 0 && (
                <span className="text-xs text-muted bg-surface px-2 py-1 rounded-full border border-border">
                  Prom. {formatter.format(p.total / p.count)}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {/* Custom Range card */}
      {billing.customRange && (
        <div className="card-hover p-5 ring-2 ring-primary/20 bg-primary-bg/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-dark">Rango Personalizado</p>
                <p className="text-xs text-muted">
                  {new Date(billing.customRange.startDate + "T00:00:00").toLocaleDateString("es-MX")}{" "}
                  — {new Date(billing.customRange.endDate + "T00:00:00").toLocaleDateString("es-MX")}
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-primary">{formatter.format(billing.customRange.total)}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-white bg-primary px-2 py-1 rounded-full">
              {billing.customRange.count} {billing.customRange.count === 1 ? "venta" : "ventas"}
            </span>
            {billing.customRange.count > 0 && (
              <span className="text-xs text-muted bg-white/60 px-2 py-1 rounded-full border border-border">
                Prom. {formatter.format(billing.customRange.total / billing.customRange.count)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
