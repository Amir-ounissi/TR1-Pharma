import franceDepartments from "@/data/france-departments-metro.json";

type GeometryFeature = {
  properties: { code: string; nom: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};

type MarkerTone = "healthy" | "watch" | "risk" | "priority";

type Marker = {
  city: string;
  longitude: number;
  latitude: number;
  tone: MarkerTone;
  pulse?: boolean;
};

const VIEWBOX = { width: 680, height: 620 };
const BOUNDS = { west: -5.7, east: 9.8, south: 41.1, north: 51.35 };

const markers: Marker[] = [
  { city: "Lille", longitude: 3.06, latitude: 50.63, tone: "risk", pulse: true },
  { city: "Rennes", longitude: -1.68, latitude: 48.11, tone: "healthy" },
  { city: "Nantes", longitude: -1.55, latitude: 47.22, tone: "watch", pulse: true },
  { city: "Paris", longitude: 2.35, latitude: 48.86, tone: "priority" },
  { city: "Strasbourg", longitude: 7.75, latitude: 48.58, tone: "healthy" },
  { city: "Dijon", longitude: 5.04, latitude: 47.32, tone: "risk" },
  { city: "Lyon", longitude: 4.84, latitude: 45.76, tone: "priority" },
  { city: "Bordeaux", longitude: -0.58, latitude: 44.84, tone: "healthy" },
  { city: "Toulouse", longitude: 1.44, latitude: 43.6, tone: "watch" },
  { city: "Montpellier", longitude: 3.88, latitude: 43.61, tone: "healthy" },
  { city: "Marseille", longitude: 5.37, latitude: 43.3, tone: "healthy", pulse: true },
  { city: "Nice", longitude: 7.26, latitude: 43.71, tone: "watch" },
];

export function LandingPilotageMap() {
  const features = (franceDepartments as { features: GeometryFeature[] }).features;

  return (
    <div
      aria-label="Illustration du pilotage national TR1 Pharma : réseau, priorités, alertes et actions terrain"
      className="relative mx-auto aspect-[1.05/1] w-full max-w-[44rem]"
      role="img"
    >
      <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(37,99,166,.13),rgba(37,99,166,.035)_48%,transparent_70%)] blur-2xl" />
      <div className="absolute inset-[17%] rounded-full border border-[#9eb7ca]/25" />
      <div className="absolute inset-[26%] rounded-full border border-[#9eb7ca]/20" />
      <div className="absolute inset-[35%] rounded-full border border-[#9eb7ca]/15" />

      <svg
        aria-hidden="true"
        className="absolute inset-[7%] h-[86%] w-[86%] overflow-visible drop-shadow-[0_24px_34px_rgba(14,29,49,.11)]"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      >
        <defs>
          <linearGradient id="landing-france-fill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fffdf8" />
            <stop offset="1" stopColor="#f4eadc" />
          </linearGradient>
        </defs>
        {features.map((feature) => (
          <path
            d={geometryToPath(feature.geometry)}
            fill="url(#landing-france-fill)"
            key={feature.properties.code}
            stroke="#b9cbd7"
            strokeOpacity=".68"
            strokeWidth="1.1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="absolute inset-[7%]">
        {markers.map((marker) => {
          const point = project(marker.longitude, marker.latitude);
          return (
            <span
              aria-hidden="true"
              className="absolute -translate-x-1/2 -translate-y-1/2"
              key={marker.city}
              style={{ left: `${(point.x / VIEWBOX.width) * 100}%`, top: `${(point.y / VIEWBOX.height) * 100}%` }}
            >
              {marker.pulse ? (
                <span
                  className={`absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full ${pulseClass(marker.tone)} animate-ping opacity-25`}
                  style={{ animationDuration: "2.5s" }}
                />
              ) : null}
              <MarkerIcon tone={marker.tone} />
            </span>
          );
        })}
      </div>

      <StatusCard
        className="left-[1%] top-[12%] hidden sm:block"
        eyebrow="Compte à risque"
        text="Réassort à relancer"
        tone="risk"
      />
      <StatusCard
        className="left-[4%] top-[51%]"
        eyebrow="Action en cours"
        text="Animation planifiée"
        tone="watch"
      />
      <StatusCard
        className="right-[1%] top-[29%] hidden md:block"
        eyebrow="Priorité terrain"
        text="Visite recommandée"
        tone="priority"
      />
      <StatusCard
        className="bottom-[10%] right-[2%]"
        eyebrow="Bonne dynamique"
        text="Réassort régulier"
        tone="healthy"
      />

      <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#0e1d31]/8 bg-white/78 px-4 py-2 font-mono text-[.58rem] font-black uppercase tracking-[.16em] text-[#596574] shadow-[0_10px_28px_rgba(14,29,49,.08)] backdrop-blur-md">
        Une vision nationale · des actions locales
      </div>
    </div>
  );
}

function StatusCard({
  className,
  eyebrow,
  text,
  tone,
}: {
  className: string;
  eyebrow: string;
  text: string;
  tone: MarkerTone;
}) {
  return (
    <div className={`absolute z-20 min-w-[10.5rem] rounded-xl border border-[#0e1d31]/8 bg-white/88 p-3 shadow-[0_16px_42px_rgba(14,29,49,.14)] backdrop-blur-md ${className}`}>
      <div className="flex items-center gap-2.5">
        <MarkerIcon tone={tone} compact />
        <div>
          <p className={`text-[.66rem] font-black ${textClass(tone)}`}>{eyebrow}</p>
          <p className="mt-0.5 text-[.62rem] font-semibold text-[#596574]">{text}</p>
        </div>
      </div>
    </div>
  );
}

function MarkerIcon({ tone, compact = false }: { tone: MarkerTone; compact?: boolean }) {
  const size = compact ? "size-4" : "size-[1.15rem]";
  if (tone === "risk") {
    return <span className={`${size} block bg-[#dc3f3b] shadow-[0_0_0_5px_rgba(220,63,59,.11)]`} style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />;
  }
  if (tone === "priority") {
    return <span className={`${size} block rotate-45 rounded-[22%] bg-[#0e1d31] shadow-[0_0_0_5px_rgba(14,29,49,.08)]`} />;
  }
  const color = tone === "healthy" ? "bg-[#2f855a]" : "bg-[#ea7015]";
  const ring = tone === "healthy" ? "shadow-[0_0_0_6px_rgba(47,133,90,.11)]" : "shadow-[0_0_0_6px_rgba(234,112,21,.12)]";
  return <span className={`${size} block rounded-full border-2 border-white ${color} ${ring}`} />;
}

function pulseClass(tone: MarkerTone) {
  if (tone === "risk") return "bg-[#dc3f3b]";
  if (tone === "healthy") return "bg-[#2f855a]";
  if (tone === "priority") return "bg-[#0e1d31]";
  return "bg-[#ea7015]";
}

function textClass(tone: MarkerTone) {
  if (tone === "risk") return "text-[#b92f2b]";
  if (tone === "healthy") return "text-[#237044]";
  if (tone === "priority") return "text-[#0e1d31]";
  return "text-[#c9562d]";
}

function project(longitude: number, latitude: number) {
  const x = ((longitude - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * VIEWBOX.width;
  const y = ((BOUNDS.north - latitude) / (BOUNDS.north - BOUNDS.south)) * VIEWBOX.height;
  return { x, y };
}

function geometryToPath(geometry: GeometryFeature["geometry"]) {
  if (geometry.type === "Polygon") return polygonToPath(geometry.coordinates as number[][][]);
  return (geometry.coordinates as number[][][][]).map(polygonToPath).join(" ");
}

function polygonToPath(polygon: number[][][]) {
  return polygon
    .map((ring) =>
      ring
        .map(([longitude, latitude], index) => {
          const point = project(longitude, latitude);
          return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
        })
        .join(" ")
        .concat(" Z"),
    )
    .join(" ");
}
