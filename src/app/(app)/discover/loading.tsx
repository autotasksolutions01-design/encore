export default function DiscoverLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-72 bg-slate-800 rounded animate-pulse mt-2" />
      </div>

      {/* Search filters skeleton */}
      <div className="flex flex-wrap gap-3">
        <div className="h-10 w-32 bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-10 w-32 bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-10 w-40 bg-slate-800 rounded-lg animate-pulse" />
      </div>

      {/* Results count skeleton */}
      <div className="h-4 w-36 bg-slate-800 rounded animate-pulse" />

      {/* Profile card skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3"
          >
            {/* Avatar */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-800 animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-slate-800 rounded animate-pulse" />
                <div className="h-3 w-20 bg-slate-800 rounded animate-pulse" />
              </div>
            </div>
            {/* Instruments */}
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-slate-800 rounded-full animate-pulse" />
              <div className="h-6 w-14 bg-slate-800 rounded-full animate-pulse" />
            </div>
            {/* Bio line */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-800 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
