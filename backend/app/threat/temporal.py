"""Temporal threat escalation: persistence, accumulation, and decay."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

LEVEL_ORDER = ["green", "yellow", "orange", "red"]


def _level_index(level: str) -> int:
    try:
        return LEVEL_ORDER.index(level.lower())
    except ValueError:
        return 0


def apply_temporal_escalation(
    target_id: str,
    base_score: int,
    base_level: str,
    tick: int,
    temporal_state: Dict[str, Any],
) -> Dict[str, Any]:
    """Adjust score/level using per-target temporal memory."""
    targets = temporal_state.setdefault("targets", {})
    entry = targets.setdefault(
        target_id,
        {
            "accumulated": 0.0,
            "suspicious_ticks": 0,
            "peak_score": 0,
            "peak_level": "green",
            "last_tick": 0,
        },
    )

    # Score decay between ticks
    if entry["last_tick"] and tick > entry["last_tick"]:
        entry["accumulated"] *= 0.82

    if base_score >= 20:
        entry["suspicious_ticks"] = min(entry["suspicious_ticks"] + 1, 20)
    elif base_score < 10:
        entry["suspicious_ticks"] = max(entry["suspicious_ticks"] - 1, 0)

    persistence_bonus = min(entry["suspicious_ticks"] * 3, 18)
    accumulation_bonus = int(min(entry["accumulated"], 25))
    entry["accumulated"] = min(40.0, entry["accumulated"] + base_score * 0.22)

    adjusted_score = min(100, base_score + persistence_bonus + accumulation_bonus)

    # Hysteresis: allow escalation faster than de-escalation
    proposed_level = _score_to_level(adjusted_score)
    prev_level_idx = _level_index(entry.get("peak_level", "green"))
    new_level_idx = _level_index(proposed_level)
    if new_level_idx > prev_level_idx:
        final_level = proposed_level
    elif new_level_idx < prev_level_idx and base_score < 15:
        final_level = LEVEL_ORDER[max(0, prev_level_idx - 1)]
    else:
        final_level = entry.get("peak_level", proposed_level)
        if _level_index(proposed_level) > _level_index(final_level):
            final_level = proposed_level

    entry["peak_score"] = max(entry["peak_score"], adjusted_score)
    entry["peak_level"] = final_level
    entry["last_tick"] = tick

    return {
        "temporal_bonus": persistence_bonus + accumulation_bonus,
        "threat_score": adjusted_score,
        "threat_level": final_level,
        "confidence_evolution": {
            "suspicious_ticks": entry["suspicious_ticks"],
            "accumulated_weight": round(entry["accumulated"], 2),
            "peak_score": entry["peak_score"],
        },
    }


def _score_to_level(score: int) -> str:
    if score >= 70:
        return "red"
    if score >= 50:
        return "orange"
    if score >= 25:
        return "yellow"
    return "green"


def snapshot_temporal_state(temporal_state: Dict[str, Any]) -> Dict[str, Any]:
    return deepcopy(temporal_state)
