import { useEffect, useRef, useState } from "react";
import type * as MaplibreNs from "maplibre-gl";
import type { Track } from "@/lib/simulation";
import {
  PROTECTED_LOCATION,
  PROTECTED_RADIUS_KM,
  formatEta,
  getTrackEtaSeconds,
  haversineKm,
} from "@/lib/simulation";

type MapT = MaplibreNs.Map;
type GeoJSONSourceT = MaplibreNs.GeoJSONSource;
type ResizeObserverT = ResizeObserver | null;

interface Props {
  tracks: Track[];
  tick: number;
}

type OverlayTrack = {
  id: string;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  level: Track["level"];
  callsign: string;
  speedKts: number;
  altitudeM: number;
  eta: string;
  forecast: Array<{ x: number; y: number }>;
};

const TRACK_VISUALS = {
  GREEN: { size: 10, glow: 20, className: "text-threat-green" },
  YELLOW: { size: 14, glow: 28, className: "text-threat-yellow" },
  ORANGE: { size: 18, glow: 34, className: "text-orange-300" },
  RED: { size: 24, glow: 42, className: "text-threat-red" },
} as const;

const MAP_STYLE: MaplibreNs.StyleSpecification = {
  "version": 8,
  "sources": {
    "osm": {
      "type": "raster",
      "tiles": [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      ],
      "tileSize": 256,
      "attribution": "© OpenStreetMap © CARTO"
    }
  },
  "layers": [
    {
      "id": "osm",
      "type": "raster",
      "source": "osm"
    }
  ]
};

function circle(center: [number, number], radiusKm: number, steps = 64) {
  const coords: [number, number][] = [];
  const km = radiusKm / 111.32;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([
      center[0] + Math.cos(a) * km / Math.cos(center[1] * Math.PI / 180),
      center[1] + Math.sin(a) * km,
    ]);
  }
  return coords;
}

function kmToLngDegrees(km: number, lat: number) {
  return km / (111.32 * Math.cos((lat * Math.PI) / 180));
}

export function MapView({ tracks, tick }: Props) {
  const mapRef = useRef<MapT | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserverT>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [projectionVersion, setProjectionVersion] = useState(0);
  const [overlayTracks, setOverlayTracks] = useState<OverlayTrack[]>([]);
  const [zoneOverlay, setZoneOverlay] = useState({
    x: 0,
    y: 0,
    outerRadius: 0,
    innerRadius: 0,
  });

  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined") return;
    if (!containerRef.current || mapRef.current) return;

    (async () => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        const waitForSizedContainer = async () => {
          while (!cancelled) {
            const node = containerRef.current;
            if (node && node.clientWidth > 0 && node.clientHeight > 0) return node;
            await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
          }
          return null;
        };

        const container = await waitForSizedContainer();
        if (cancelled || !container) return;

        console.log("MAP CONTAINER SIZE:", container.clientWidth, container.clientHeight);

        const map = new maplibregl.Map({
          container,
          style: MAP_STYLE,
          center: PROTECTED_LOCATION,
          zoom: 11.5,
          pitch: 22,
          bearing: -8,
        });

        console.log("MAP CREATED", map);

        const resizeMap = () => {
          requestAnimationFrame(() => {
            if (!cancelled) {
              map.resize();
              setProjectionVersion((value) => value + 1);
            }
          });
        };

        map.on("error", (e) => {
          console.error("[MapView]", e.error || e);
          setFailed(true);
        });

        map.on("load", () => {
          console.log("MAP LOADED");
          map.resize();
          setReady(true);
          map.addSource("inner-zone", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [circle(PROTECTED_LOCATION, PROTECTED_RADIUS_KM * 0.5)] },
            },
          });
          map.addLayer({
            id: "inner-zone-fill",
            type: "fill",
            source: "inner-zone",
            paint: { "fill-color": "#b91c1c", "fill-opacity": 0.18 },
          });
          map.addLayer({
            id: "inner-zone-line",
            type: "line",
            source: "inner-zone",
            paint: { "line-color": "#ef4444", "line-width": 3, "line-dasharray": [2, 2] },
          });

          map.addSource("outer-zone", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [circle(PROTECTED_LOCATION, PROTECTED_RADIUS_KM)] },
            },
          });
          map.addLayer({
            id: "outer-zone-fill",
            type: "fill",
            source: "outer-zone",
            paint: { "fill-color": "#f59e0b", "fill-opacity": 0.08 },
          });
          map.addLayer({
            id: "outer-zone-line",
            type: "line",
            source: "outer-zone",
            paint: { "line-color": "#facc15", "line-width": 2.5, "line-dasharray": [4, 4] },
          });

          map.addSource("tracks", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addSource("trails", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addSource("forecasts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addSource("headings", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addSource("breach-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

          map.addLayer({
            id: "trails",
            type: "line",
            source: "trails",
            paint: {
              "line-color": [
                "match",
                ["get", "level"],
                "RED", "#ef4444",
                "ORANGE", "#fb923c",
                "YELLOW", "#facc15",
                "#22c55e",
              ],
              "line-width": 2.6,
              "line-opacity": 0.95,
            },
          });
          map.addLayer({
            id: "forecasts",
            type: "line",
            source: "forecasts",
            paint: {
              "line-color": [
                "match",
                ["get", "level"],
                "RED", "#fb7185",
                "ORANGE", "#fdba74",
                "YELLOW", "#fde047",
                "#86efac",
              ],
              "line-width": 2,
              "line-opacity": 0.9,
              "line-dasharray": [2, 2],
            },
          });
          map.addLayer({
            id: "headings",
            type: "line",
            source: "headings",
            paint: {
              "line-color": "#ffffff",
              "line-width": 1.2,
              "line-opacity": 0.85,
            },
          });
          map.addLayer({
            id: "tracks-glow",
            type: "circle",
            source: "tracks",
            paint: {
              "circle-radius": ["match", ["get", "level"], "RED", 22, "ORANGE", 18, "YELLOW", 14, 10],
              "circle-color": ["match", ["get", "level"], "RED", "#ef4444", "ORANGE", "#fb923c", "YELLOW", "#facc15", "#22c55e"],
              "circle-opacity": 0.28,
            },
          });
          map.addLayer({
            id: "tracks",
            type: "circle",
            source: "tracks",
            paint: {
              "circle-radius": ["match", ["get", "level"], "RED", 7, "ORANGE", 6, "YELLOW", 5, 4],
              "circle-color": ["match", ["get", "level"], "RED", "#ef4444", "ORANGE", "#fb923c", "YELLOW", "#facc15", "#22c55e"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          });

          map.addSource("center", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: PROTECTED_LOCATION } },
          });
          map.addLayer({
            id: "center-glow",
            type: "circle",
            source: "center",
            paint: { "circle-radius": 18, "circle-color": "#ef4444", "circle-opacity": 0.2 },
          });
          map.addLayer({
            id: "center",
            type: "circle",
            source: "center",
            paint: { "circle-radius": 8, "circle-color": "#ef4444", "circle-stroke-color": "#fff", "circle-stroke-width": 2 },
          });
          map.addLayer({
            id: "breach-points",
            type: "circle",
            source: "breach-points",
            paint: {
              "circle-radius": 5,
              "circle-color": "#ef4444",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
            },
          });

          const requestProjection = () => setProjectionVersion((value) => value + 1);
          map.on("move", requestProjection);
          map.on("zoom", requestProjection);
          map.on("rotate", requestProjection);
          map.on("pitch", requestProjection);

          resizeMap();
          setFailed(false);
          setReady(true);
        });

        if (typeof ResizeObserver !== "undefined") {
          resizeObserverRef.current = new ResizeObserver(() => resizeMap());
          resizeObserverRef.current.observe(container);
        }

        resizeMap();
        mapRef.current = map;
      } catch (error) {
        console.error("[MapView] failed to initialize", error);
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const tSrc = map.getSource("tracks") as GeoJSONSourceT | undefined;
    const trSrc = map.getSource("trails") as GeoJSONSourceT | undefined;
    const fSrc = map.getSource("forecasts") as GeoJSONSourceT | undefined;
    const hSrc = map.getSource("headings") as GeoJSONSourceT | undefined;
    const breachSrc = map.getSource("breach-points") as GeoJSONSourceT | undefined;
    if (!tSrc || !trSrc || !fSrc || !hSrc || !breachSrc) return;

    tSrc.setData({
      type: "FeatureCollection",
      features: tracks.map((track) => ({
        type: "Feature",
        properties: { level: track.level },
        geometry: { type: "Point", coordinates: [track.kf.x[0], track.kf.x[1]] },
      })),
    });

    trSrc.setData({
      type: "FeatureCollection",
      features: tracks.map((track) => ({
        type: "Feature",
        properties: { level: track.level },
        geometry: { type: "LineString", coordinates: track.history },
      })),
    });

    fSrc.setData({
      type: "FeatureCollection",
      features: tracks.map((track) => ({
        type: "Feature",
        properties: { level: track.level },
        geometry: {
          type: "LineString",
          coordinates: [[track.kf.x[0], track.kf.x[1]], ...track.kf.forecast(6, 1)],
        },
      })),
    });

    hSrc.setData({
      type: "FeatureCollection",
      features: tracks.map((track) => ({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [track.kf.x[0], track.kf.x[1]],
            [track.kf.x[0] + track.vLng * 12, track.kf.x[1] + track.vLat * 12],
          ],
        },
      })),
    });

    const breachTrack =
      tracks.find((track) => track.level === "RED") ??
      tracks.find((track) => track.level === "ORANGE");

    breachSrc.setData({
      type: "FeatureCollection",
      features: breachTrack
        ? [{
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: breachTrack.kf.forecast(4, 1)[3] ?? [breachTrack.kf.x[0], breachTrack.kf.x[1]],
            },
          }]
        : [],
    });
  }, [tracks, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const centerPoint = map.project(PROTECTED_LOCATION);
    const outerPoint = map.project([PROTECTED_LOCATION[0] + kmToLngDegrees(PROTECTED_RADIUS_KM, PROTECTED_LOCATION[1]), PROTECTED_LOCATION[1]]);
    const innerPoint = map.project([PROTECTED_LOCATION[0] + kmToLngDegrees(PROTECTED_RADIUS_KM * 0.5, PROTECTED_LOCATION[1]), PROTECTED_LOCATION[1]]);

    setZoneOverlay({
      x: centerPoint.x,
      y: centerPoint.y,
      outerRadius: Math.abs(outerPoint.x - centerPoint.x),
      innerRadius: Math.abs(innerPoint.x - centerPoint.x),
    });

    const bounds = map.getContainer().getBoundingClientRect();
    setOverlayTracks(
      tracks
        .map((track) => {
          const projected = map.project([track.kf.x[0], track.kf.x[1]]);
          const forecast = track.kf
            .forecast(4, 1)
            .map(([lng, lat]) => map.project([lng, lat]))
            .map((point) => ({ x: point.x, y: point.y }));

          return {
            id: track.id,
            x: projected.x,
            y: projected.y,
            labelX: projected.x + 18,
            labelY: projected.y - 24,
            level: track.level,
            callsign: track.callsign,
            speedKts: track.speedKts,
            altitudeM: track.altitudeM,
            eta: formatEta(getTrackEtaSeconds(track)),
            forecast,
          };
        })
        .filter((track) => track.x > -80 && track.y > -80 && track.x < bounds.width + 80 && track.y < bounds.height + 80),
    );
  }, [tracks, ready, projectionVersion, tick]);

  const breachTrack =
    tracks.find((track) => track.level === "RED") ??
    tracks.find((track) => track.level === "ORANGE") ??
    tracks.find((track) => track.level === "YELLOW");
  const breachForecast = breachTrack?.kf.forecast(4, 1)[3];
  const breachDistance = breachForecast ? haversineKm(breachForecast, PROTECTED_LOCATION) : null;

  return (
    <div className="relative h-full min-h-[300px] overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-0 w-full h-full" />
      {!ready && !failed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center font-mono text-xs text-muted-foreground">
          ◤ INITIALIZING TACTICAL OVERLAY... ◥
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center font-mono text-xs text-threat-red/80">
          ◤ MAP RENDER RECOVERY ACTIVE ◥
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 z-20">
        {zoneOverlay.outerRadius > 0 ? (
          <>
            <div
              className="absolute rounded-full border border-threat-yellow/70 zone-ring-slow"
              style={{
                left: zoneOverlay.x,
                top: zoneOverlay.y,
                width: zoneOverlay.outerRadius * 2,
                height: zoneOverlay.outerRadius * 2,
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 45px rgba(250,204,21,0.14)",
              }}
            />
            <div
              className="absolute rounded-full border border-threat-red/75 zone-ring-fast"
              style={{
                left: zoneOverlay.x,
                top: zoneOverlay.y,
                width: zoneOverlay.innerRadius * 2,
                height: zoneOverlay.innerRadius * 2,
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 60px rgba(239,68,68,0.24)",
              }}
            />
            <div
              className="absolute tactical-radar-cone"
              style={{
                left: zoneOverlay.x,
                top: zoneOverlay.y,
                width: zoneOverlay.outerRadius * 1.9,
                height: zoneOverlay.outerRadius * 1.9,
                transform: "translate(-50%, -50%)",
              }}
            />
            <div
              className="absolute rounded-full border border-threat-red/30 bg-threat-red/10"
              style={{
                left: zoneOverlay.x,
                top: zoneOverlay.y,
                width: 34,
                height: 34,
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 24px rgba(239,68,68,0.45)",
              }}
            />
          </>
        ) : null}
        {overlayTracks.map((track) => {
          const visual = TRACK_VISUALS[track.level];
          return (
            <div key={track.id}>
              {track.forecast.map((point, index) => (
                <div
                  key={`${track.id}-ghost-${index}`}
                  className="absolute rounded-full border border-white/50"
                  style={{
                    left: point.x,
                    top: point.y,
                    width: Math.max(6, visual.size - index * 2),
                    height: Math.max(6, visual.size - index * 2),
                    opacity: 0.15 + (4 - index) * 0.08,
                    transform: "translate(-50%, -50%)",
                    backgroundColor:
                      track.level === "RED" ? "rgba(239,68,68,0.28)" :
                      track.level === "ORANGE" ? "rgba(251,146,60,0.24)" :
                      track.level === "YELLOW" ? "rgba(250,204,21,0.22)" :
                      "rgba(34,197,94,0.2)",
                  }}
                />
              ))}
              <div
                className={`absolute rounded-full border-2 border-white ${visual.className}`}
                style={{
                  left: track.x,
                  top: track.y,
                  width: visual.glow,
                  height: visual.glow,
                  opacity: 0.16,
                  transform: "translate(-50%, -50%)",
                  boxShadow: `0 0 ${visual.glow}px currentColor`,
                }}
              />
              <div
                className={`absolute rounded-full border-[3px] border-white tactical-track-pulse ${visual.className}`}
                style={{
                  left: track.x,
                  top: track.y,
                  width: visual.size,
                  height: visual.size,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: "currentColor",
                  boxShadow: `0 0 ${visual.glow * 0.7}px currentColor`,
                  ["--pulse-scale" as any]: track.level === "RED" ? "1.28" : track.level === "ORANGE" ? "1.22" : track.level === "YELLOW" ? "1.18" : "1.12",
                  ["--pulse-duration" as any]: track.level === "RED" ? "1.1s" : track.level === "ORANGE" ? "1.35s" : track.level === "YELLOW" ? "1.7s" : "2.2s",
                }}
              />
              <div
                className={`absolute ${visual.className}`}
                style={{
                  left: track.labelX,
                  top: track.labelY,
                  textShadow: "0 0 14px currentColor",
                }}
              >
                <div className="font-mono text-[13px] font-bold tracking-[0.06em]">{track.callsign}</div>
                <div className="font-mono text-[11px]">{track.speedKts}kts • {track.altitudeM}m</div>
                <div className="font-mono text-[11px]">ETA {track.eta}</div>
              </div>
            </div>
          );
        })}
        {breachTrack && breachDistance !== null ? (
          <div
            className="absolute border border-threat-red/60 bg-black/70 px-2 py-1 font-mono text-[11px] text-threat-red"
            style={{
              left: zoneOverlay.x + zoneOverlay.innerRadius * 0.7,
              top: zoneOverlay.y - zoneOverlay.innerRadius * 1.2,
              boxShadow: "0 0 24px rgba(239,68,68,0.22)",
            }}
          >
            <div className="font-semibold">PREDICTED BREACH</div>
            <div>{formatEta(getTrackEtaSeconds(breachTrack))}</div>
          </div>
        ) : null}
        <div className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-panel-border bg-black/55 font-mono text-[12px] text-muted-foreground">
          N
        </div>
        <div className="absolute right-4 top-4 grid w-24 gap-2">
          <div className="border border-panel-border bg-black/55 px-3 py-2 font-mono text-[11px]">
            <div className="text-muted-foreground">WIND</div>
            <div className="mt-1 text-foreground">245° / 18kts</div>
          </div>
          <div className="border border-panel-border bg-black/55 px-3 py-2 font-mono text-[11px]">
            <div className="text-muted-foreground">VISIBILITY</div>
            <div className="mt-1 text-foreground">10km</div>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 border border-panel-border bg-black/55 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
          <div className="mb-1 text-foreground">LEGEND</div>
          <div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-threat-green" />AUTHORIZED</div>
          <div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-threat-yellow" />UNKNOWN</div>
          <div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-orange-400" />SUSPICIOUS</div>
          <div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-threat-red" />INTRUSION</div>
          <div><span className="mr-2 inline-block h-2 w-2 rounded-full border border-white/60" />PREDICTION</div>
          <div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-400" />RADAR SWEEP</div>
        </div>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {["◉", "◌", "⌖", "▣", "⦿"].map((icon) => (
            <button
              key={icon}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center border border-panel-border bg-black/55 font-mono text-[12px] text-muted-foreground"
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          {["+", "−", "⟳", "⌂"].map((icon) => (
            <button
              key={icon}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center border border-panel-border bg-black/55 font-mono text-[14px] text-muted-foreground"
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="absolute bottom-4 right-24 font-mono text-[10px] text-muted-foreground">2 km</div>
        <div className="absolute left-[27%] top-[45%] font-mono text-[13px] text-threat-yellow">
          <div className="font-semibold">RESTRICTED ZONE</div>
          <div>2.5KM RADIUS</div>
        </div>
        <div className="absolute left-[46%] top-[49%] -translate-x-1/2 font-mono text-[13px] text-threat-red">
          <div className="font-semibold">RESTRICTED CORE</div>
          <div>1.25KM RADIUS</div>
        </div>
      </div>
    </div>
  );
}
