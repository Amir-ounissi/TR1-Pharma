"use client";

export function NetworkMapLayout({
  left,
  center,
  right,
  bottom,
}: {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  bottom: React.ReactNode;
}) {
  return (
    <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[180px_minmax(0,1fr)_390px]">
      <aside className="min-h-0 space-y-3">{left}</aside>
      <div className="flex min-h-0 flex-col gap-3">
        {center}
        {bottom}
      </div>
      <aside className="min-h-0">{right}</aside>
    </div>
  );
}
