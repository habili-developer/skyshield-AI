import { Fragment, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TargetIcon = (color, id, isSelected = false, isArchived = false) =>
  L.divIcon({
    className: 'custom-target-icon',
    html: `
      <div style="position: relative; width: 44px; height: 44px;">
        <div style="position: absolute; top: 14px; left: 14px; width: 12px; height: 12px; border-radius: 999px; background: ${color}; border: 2px solid #ffffff; box-shadow: 0 0 ${isSelected ? '26px' : '18px'} ${color}; opacity: ${isArchived ? '0.65' : '1'};"></div>
        <div style="position: absolute; top: 7px; left: 17px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 12px solid ${color}; transform-origin: 50% 16px; transform: rotate(var(--heading, 0deg)); filter: drop-shadow(0 0 8px ${color}); opacity: 0.9;"></div>
        <div style="position: absolute; top: 2px; left: 24px; padding: 1px 6px; border-radius: 999px; background: rgba(10, 10, 12, 0.94); border: 1px solid ${isSelected ? 'rgba(34, 211, 238, 0.85)' : 'rgba(63, 63, 70, 1)'}; color: rgba(244, 244, 245, 1); font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);">
          ${id}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [20, 20],
  });

const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 0.8 });
    }
  }, [center, zoom, map]);
  return null;
};

const predictPosition = (position, seconds = 45) => {
  if (!position?.lat || !position?.lon) return null;
  const heading = ((position.heading_deg || 0) * Math.PI) / 180;
  const distanceKm = ((position.speed_mps || 0) * seconds) / 1000;
  const dLat = (Math.cos(heading) * distanceKm) / 111;
  const dLon = (Math.sin(heading) * distanceKm) / (111 * Math.cos((position.lat * Math.PI) / 180) || 1);
  return [position.lat + dLat, position.lon + dLon];
};

const AirspaceMap = ({
  tracks,
  restrictedZone,
  history,
  selectedTargetId,
  onSelectTarget,
  zoneCenter,
  zoneRadiusKM,
  zoneName,
  onZoneCenterChange,
}) => {
  const [mapZoom, setMapZoom] = useState(9);

  useEffect(() => {
    const radius = zoneRadiusKM || 50;
    if (radius >= 400) {
      setMapZoom(7);
    } else if (radius >= 100) {
      setMapZoom(8);
    } else if (radius >= 50) {
      setMapZoom(9);
    } else {
      setMapZoom(11);
    }
  }, [zoneRadiusKM]);

  const displayCenter = zoneCenter ? { lat: zoneCenter[0], lon: zoneCenter[1] } : (restrictedZone?.center || { lat: -6.1748, lon: 35.7384 });
  const displayRadius = (zoneRadiusKM || (restrictedZone?.radius_km || 2)) * 1000;

  const handleMapClick = (e) => {
    if (onZoneCenterChange) {
      onZoneCenterChange([e.latlng.lat, e.latlng.lng]);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-[#08080a]">
      <div className="radar-sweep" />
      <MapContainer
        center={[displayCenter.lat, displayCenter.lon]}
        zoom={mapZoom}
        zoomControl={false}
        style={{ height: '100%', width: '100%', background: '#050506' }}
        onClick={handleMapClick}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; CARTO'
        />

        <MapController center={[displayCenter.lat, displayCenter.lon]} zoom={mapZoom} />

        <Circle
          center={[displayCenter.lat, displayCenter.lon]}
          radius={displayRadius}
          pathOptions={{
            color: '#f43f5e',
            fillColor: '#f43f5e',
            fillOpacity: 0.06,
            weight: 2,
            dashArray: '8 6',
            className: 'zone-glow',
          }}
        />

        {tracks.map((track) => {
          const color =
            track.threat_level === 'red'
              ? '#ef4444'
              : track.threat_level === 'orange'
                ? '#f97316'
                : track.threat_level === 'yellow'
                  ? '#f59e0b'
                  : '#10b981';
          const isSelected = selectedTargetId === track.target_id;
          const pulseClass = track.threat_level === 'red' ? 'pulse-threat' : '';
          const predicted = predictPosition(track.position);
          const confidenceRadius = Math.max(300, 1400 * (1 - (track.fusion_confidence || 0.5)));

          return (
            <Fragment key={track.target_id}>
              <Circle
                center={[track.position.lat, track.position.lon]}
                radius={confidenceRadius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: isSelected ? 0.08 : 0.035,
                  opacity: isSelected ? 0.42 : 0.22,
                  weight: 1,
                }}
              />
              <Marker
                position={[track.position.lat, track.position.lon]}
                icon={TargetIcon(color, track.target_id, isSelected, false)}
                eventHandlers={{
                  click: () => onSelectTarget?.(track.target_id),
                  add: event => {
                    const element = event.target.getElement();
                    element?.style.setProperty('--heading', `${track.position.heading_deg || 0}deg`);
                  },
                }}
              >
                <Popup>
                  <div className="min-w-[180px] rounded-lg border border-zinc-800 bg-[#0d0d10] p-3 text-zinc-300 shadow-2xl">
                    <div className="mb-2 flex items-center gap-2 border-b border-zinc-800 pb-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${pulseClass}`} style={{ backgroundColor: color }} />
                      <span className="text-xs font-semibold text-white">{track.target_id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      <span className="text-zinc-500">Threat</span>
                      <span className="font-medium capitalize" style={{ color }}>
                        {track.threat_level}
                      </span>
                      <span className="text-zinc-500">Fusion</span>
                      <span>{((track.fusion_confidence || 0) * 100).toFixed(0)}%</span>
                      <span className="text-zinc-500">Altitude</span>
                      <span>{track.position.altitude_m} m</span>
                      <span className="text-zinc-500">Speed</span>
                      <span>{track.position.speed_mps} m/s</span>
                      <span className="text-zinc-500">Sensors</span>
                      <span>{track.source_sensors.length}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>

              {history[track.target_id] && (
                <Polyline
                  positions={history[track.target_id].map(h => [h.lat, h.lon])}
                  pathOptions={{ color, weight: 3, opacity: isSelected ? 0.72 : 0.36, dashArray: '4 8' }}
                />
              )}
              {predicted && (
                <Polyline
                  positions={[[track.position.lat, track.position.lon], predicted]}
                  pathOptions={{ color, weight: 2, opacity: isSelected ? 0.55 : 0.22, dashArray: '2 8' }}
                />
              )}
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default AirspaceMap;
