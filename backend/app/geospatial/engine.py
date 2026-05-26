"""Geospatial engine for real coordinates, zones, geofences, and trajectories."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

try:
    from geopy.distance import geodesic
except ImportError:  # pragma: no cover
    geodesic = None

try:
    from shapely.geometry import Point, shape
except ImportError:  # pragma: no cover
    Point = None
    shape = None


Coordinate = Tuple[float, float]


@dataclass
class Region:
    deployment_name: str
    map_center: Dict[str, float]
    operational_radius_km: float
    restricted_zones: List[Dict[str, Any]]
    geofences: List[Dict[str, Any]]
    coordinate_metadata: Dict[str, Any]


def haversine_km(a: Coordinate, b: Coordinate) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    s1 = math.sin(dlat / 2) ** 2
    s2 = math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(s1 + s2))


class GeospatialEngine:
    def __init__(self, region: Region) -> None:
        self.region = region

    @classmethod
    def from_file(cls, path: Path) -> "GeospatialEngine":
        payload = json.loads(path.read_text())
        return cls(Region(**payload))

    def distance_km(self, a: Coordinate, b: Coordinate) -> float:
        if geodesic is not None:
            return float(geodesic(a, b).km)
        return haversine_km(a, b)

    def point_in_polygon(self, lat: float, lon: float, geojson_geometry: Dict[str, Any]) -> bool:
        if Point is None or shape is None:
            return False
        return bool(shape(geojson_geometry).contains(Point(lon, lat)))

    def evaluate_position(self, lat: float, lon: float) -> Dict[str, Any]:
        point = (lat, lon)
        zone_results = []
        for zone in self.region.restricted_zones:
            center = zone.get("center", self.region.map_center)
            distance = self.distance_km(point, (center["lat"], center["lon"]))
            radius = float(zone.get("radius_km", 0))
            zone_results.append(
                {
                    "zone_id": zone.get("id"),
                    "name": zone.get("name"),
                    "distance_km": round(distance, 3),
                    "inside": distance <= radius,
                    "radius_km": radius,
                }
            )

        geofence_hits = []
        for geofence in self.region.geofences:
            geometry = geofence.get("geometry")
            if geometry and self.point_in_polygon(lat, lon, geometry):
                geofence_hits.append({"id": geofence.get("id"), "name": geofence.get("name")})

        return {
            "lat": lat,
            "lon": lon,
            "zones": zone_results,
            "geofence_hits": geofence_hits,
            "inside_restricted_area": any(item["inside"] for item in zone_results) or bool(geofence_hits),
        }

    def trajectory_summary(self, points: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        rows = list(points)
        if len(rows) < 2:
            return {"distance_km": 0.0, "direction_changes": 0, "samples": len(rows)}
        distance = 0.0
        headings: List[float] = []
        for prev, curr in zip(rows, rows[1:]):
            distance += self.distance_km((prev["lat"], prev["lon"]), (curr["lat"], curr["lon"]))
            if "heading_deg" in curr:
                headings.append(float(curr["heading_deg"]))
        direction_changes = sum(1 for prev, curr in zip(headings, headings[1:]) if abs(curr - prev) >= 35)
        return {
            "distance_km": round(distance, 3),
            "direction_changes": direction_changes,
            "samples": len(rows),
        }

    def active_zone_for_legacy_pipeline(self) -> Dict[str, Any]:
        zone = self.region.restricted_zones[0]
        return {
            "center": zone.get("center", self.region.map_center),
            "radius_km": zone.get("radius_km", self.region.operational_radius_km),
            "name": zone.get("name", self.region.deployment_name),
        }
