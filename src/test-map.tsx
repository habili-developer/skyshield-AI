import { useEffect, useRef, useState } from "react";

export default function TestMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      
      const m = new maplibregl.Map({
        container: containerRef.current!,
        style: "https://demotiles.maplibre.org/style.json",
        center: [35.7384, -6.1748],
        zoom: 11,
      });

      m.on("load", () => {
        // Giant restricted circle
        m.addSource("circle", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: [35.7384, -6.1748],
            },
          },
        });
        m.addLayer({
          id: "circle",
          type: "circle",
          source: "circle",
          paint: {
            "circle-radius": 300,
            "circle-color": "#ff0000",
            "circle-opacity": 0.3,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 10,
          },
        });

        // 5 giant moving dots
        const dots = [
          { lng: 35.68, lat: -6.12, color: "#ff0000", label: "T-1" },
          { lng: 35.78, lat: -6.22, color: "#ffff00", label: "T-2" },
          { lng: 35.65, lat: -6.22, color: "#00ff00", label: "T-3" },
          { lng: 35.82, lat: -6.12, color: "#ff00ff", label: "T-4" },
          { lng: 35.73, lat: -6.07, color: "#00ffff", label: "T-5" },
        ];

        m.addSource("dots", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: dots.map((d, i) => ({
              type: "Feature",
              properties: { color: d.color, label: d.label },
              geometry: { type: "Point", coordinates: [d.lng, d.lat] },
            })),
          },
        });
        m.addLayer({
          id: "dots",
          type: "circle",
          source: "dots",
          paint: {
            "circle-radius": 40,
            "circle-color": ["get", "color"],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 5,
          },
        });
        m.addLayer({
          id: "dot-labels",
          type: "symbol",
          source: "dots",
          layout: {
            "text-field": ["get", "label"],
            "text-size": 20,
            "text-offset": [0, 2.5],
          },
          paint: { "text-color": "#ffffff" },
        });

        // Trajectories
        m.addSource("trails", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: dots.map((d) => ({
              type: "Feature",
              properties: { color: d.color },
              geometry: {
                type: "LineString",
                coordinates: [
                  [d.lng - 0.05, d.lat + 0.05],
                  [d.lng, d.lat],
                ],
              },
            })),
          },
        });
        m.addLayer({
          id: "trails",
          type: "line",
          source: "trails",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 10,
          },
        });

        setMap(m);
      });
    })();

    return () => {
      if (map) map.remove();
    };
  }, []);

  return (
    <div className="h-screen w-screen relative">
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* HUGE radar sweep */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div 
          className="h-[800px] w-[800px] rounded-full" 
          style={{
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(255,0,0,0.4) 30deg, transparent 60deg)",
            animation: "sweep 3s linear infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
