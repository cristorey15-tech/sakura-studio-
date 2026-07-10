"use client";

interface SalesStats {
  todaySalesCount: number;
  todayTotalUSD: number;
  todayTotalBs: number;
  monthlyTotalUSD: number;
  monthlyTotalBs: number;
}

export default function VentasStats({ stats }: { stats: SalesStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="card-hover p-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Ventas Hoy</p>
            <p className="text-xl font-bold text-dark mt-0.5">{stats.todaySalesCount}</p>
          </div>
        </div>
      </div>
      <div className="card-hover p-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Total Hoy</p>
            <p className="text-xl font-bold text-dark mt-0.5">${stats.todayTotalUSD.toFixed(2)} USD</p>
            {stats.todayTotalBs > 0 && (
              <p className="text-xs font-semibold text-amber-700 mt-0.5">Bs {stats.todayTotalBs.toFixed(2)}</p>
            )}
          </div>
        </div>
      </div>
      <div className="card-hover p-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Total General</p>
            <p className="text-xl font-bold text-dark mt-0.5">${stats.monthlyTotalUSD.toFixed(2)} USD</p>
            {stats.monthlyTotalBs > 0 && (
              <p className="text-xs font-semibold text-amber-700 mt-0.5">Bs {stats.monthlyTotalBs.toFixed(2)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
