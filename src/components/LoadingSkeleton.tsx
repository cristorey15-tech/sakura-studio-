/** Reusable loading skeleton components */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-4 bg-gray-200 rounded-md animate-pulse ${className}`}
    />
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200 rounded-xl animate-pulse ${className}`}
    />
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-border p-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-3/5" />
          <SkeletonLine className="w-2/5" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="space-y-2">
      <SkeletonLine className="h-8 w-48" />
      <SkeletonLine className="h-4 w-64" />
    </div>
  );
}

export function SkeletonStatsRow({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} className="h-24" />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5, height = "h-20" }: { count?: number; height?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} className={height} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 4, height = "h-40" }: { count?: number; height?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} className={height} />
      ))}
    </div>
  );
}

export function SkeletonDetailPage() {
  return (
    <div className="space-y-4">
      <SkeletonLine className="h-8 w-48" />
      <SkeletonBlock className="h-40" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
      </div>
    </div>
  );
}
