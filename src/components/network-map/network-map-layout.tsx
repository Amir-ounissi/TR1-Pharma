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
      <aside className="order-3 min-h-0 space-y-3 md:order-2 xl:order-1">{left}</aside>
      <div className="order-1 flex min-h-0 flex-col gap-3 xl:order-2">
        {center}
        {bottom}
      </div>
      <aside className="order-2 min-h-0 xl:order-3">{right}</aside>
    </div>
  );
}
