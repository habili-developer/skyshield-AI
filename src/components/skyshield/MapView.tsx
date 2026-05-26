import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Track } from "@/lib/simulation";
import { DODOMA, PROTECTED_RADIUS_KM } from "@/lib/simulation";

interface Props {
  tracks: Track[];
}

// Generate a circle polygon
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

export function MapView({ tracks }: Props) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: DODOMA,
      zoom: 12,
      pitch: 55,
      bearing: -18,
      antialias: true,
    });

    map.on("load", () => {
      // 3D buildings extrusion
      const layers = map.getStyle().layers || [];
      const labelLayer = layers.find(
        (l) => l.type === "symbol" && (l.layout as any)?.["text-field"]
      );
      try {
        map.addLayer(
          {
            id: "3d-buildings",
            source: "carto",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 12,
            paint: {
              "fill-extrusion-color": "#1f2937",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 12],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.85,
            },
          },
          labelLayer?.id
        );
      } catch {
        /* source layer may not exist on style - safe to ignore */
      }

      // Protected zone
      map.addSource("zone", {
        type: "geojson",
        data: {
          type: "Feature", properties: {},
          geometry: { type: "Polygon", coordinates: [circle(DODOMA, PROTECTED_RADIUS_KM)] },
        },
      });
      map.addLayer({
        id: "zone-fill", type: "fill", source: "zone",
        paint: { "fill-color": "#ef4444", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "zone-line", type: "line", source: "zone",
        paint: {
          "line-color": "#ef4444", "line-width": 1.5,
          "line-dasharray": [3, 3],
        },
      });

      // Tracks sources
      map.addSource("tracks", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("trails", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("forecasts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      map.addLayer({
        id: "trails", type: "line", source: "trails",
        paint: {
          "line-color": ["match", ["get", "level"],
            "RED", "#ef4444", "YELLOW", "#facc15", "#22c55e"],
          "line-width": 1.5,
          "line-opacity": 0.7,
        },
      });
      map.addLayer({
        id: "forecasts", type: "line", source: "forecasts",
        paint: {
          "line-color": ["match", ["get", "level"],
            "RED", "#ef4444", "YELLOW", "#facc15", "#22c55e"],
          "line-width": 1,
          "line-opacity": 0.6,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "tracks", type: "circle", source: "tracks",
        paint: {
          "circle-radius": 6,
          "circle-color": ["match", ["get", "level"],
            "RED", "#ef4444", "YELLOW", "#facc15", "#22c55e"],
          "circle-stroke-color": "#0a0a0a", "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "track-labels", type: "symbol", source: "tracks",
        layout: {
          "text-field": ["get", "callsign"],
          "text-size": 10,
          "text-offset": [0, 1.4],
          "text-font": ["Open Sans Bold"],
        },
        paint: {
          "text-color": "#e5e7eb",
          "text-halo-color": "#000000",
          "text-halo-width": 1.5,
        },
      });

      // Center marker
      map.addSource("center", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: DODOMA } },
      });
      map.addLayer({
        id: "center", type: "circle", source: "center",
        paint: { "circle-radius": 5, "circle-color": "#ef4444", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 },
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update track data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const tSrc = map.getSource("tracks") as maplibregl.GeoJSONSource | undefined;
    const trSrc = map.getSource("trails") as maplibregl.GeoJSONSource | undefined;
    const fSrc = map.getSource("forecasts") as maplibregl.GeoJSONSource | undefined;
    if (!tSrc || !trSrc || !fSrc) return;

    tSrc.setData({
      type: "FeatureCollection",
      features: tracks.map((t) => ({
        type: "Feature",
        properties: { callsign: t.callsign, level: t.level },
        geometry: { type: "Point", coordinates: [t.kf.x[0], t.kf.x[1]] },
      })),
    });
    trSrc.setData({
      type: "FeatureCollection",
      features: tracks.map((t) => ({
        type: "Feature",
        properties: { level: t.level },
        geometry: { type: "LineString", coordinates: t.history },
      })),
    });
    fSrc.setData({
      type: "FeatureCollection",
      features: tracks.map((t) => ({
        type: "Feature",
        properties: { level: t.level },
        geometry: {
          type: "LineString",
          coordinates: [[t.kf.x[0], t.kf.x[1]], ...t.kf.forecast(20, 1)],
        },
      })),
    });
  }, [tracks]);

  return (
    <div className="relative flex-1">
      <div ref={containerRef} className="absolute inset-0" />
      {/* HUD overlays */}
      <div className="pointer-events-none absolute inset-0 hud-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0 scanline" />

      {/* Corner brackets */}
      <div className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-threat-red/60" />
      <div className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-threat-red/60" />
      <div className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-threat-red/60" />
      <div className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-threat-red/60" />

      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] text-threat-red/80">
        ◤ TACTICAL OVERLAY • DODOMA SECTOR ◥
      </div>
    </div>
  );
}
