
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import httpx

from backend.app.config import settings
from backend.app.explainability.trace import format_trace_for_llm
from backend.app.services.retrieval import RulebookRetriever


DEFENSIVE_SYSTEM_PROMPT = """You are SkyShield Copilot, a defensive airspace monitoring assistant.
You help operators interpret alerts, summarize incidents, and explain monitoring decisions.
You must stay within defensive surveillance use cases only.
Never provide instructions for weaponization, targeting, evasion, or offensive attack planning.
Keep answers grounded in the supplied state and rulebook excerpts.
When data is incomplete, say so clearly."""


class BaseProvider:
    provider_name = "base"

    def __init__(self, model: str) -> None:
        self.model = model

    def chat(self, system_prompt: str, user_prompt: str) -> str:
        raise NotImplementedError


class MockProvider(BaseProvider):
    provider_name = "mock"

    def chat(self, system_prompt: str, user_prompt: str) -> str:
        # 1. Extract context data from the prompt using more robust markers
        snapshot = {}
        sections = []
        question = ""
        
        try:
            # Extract Question
            if "Question:" in user_prompt:
                question = user_prompt.split("Question:")[1].split("\n\n")[0].strip()
            
            # Extract System State - Find the JSON between markers
            state_marker = "Current system state:"
            if state_marker in user_prompt:
                start_idx = user_prompt.find(state_marker) + len(state_marker)
                # Find the first '{' and matching '}' for the full object
                json_start = user_prompt.find("{", start_idx)
                if json_start != -1:
                    # Simple but effective: find the matching closing brace for the whole block
                    # Since we know the structure is a single large JSON object
                    json_end = user_prompt.rfind("}", json_start, user_prompt.find("Relevant rulebook sections:"))
                    if json_end == -1: # Fallback if next section not found
                         json_end = user_prompt.rfind("}")
                    
                    state_text = user_prompt[json_start:json_end+1]
                    snapshot = json.loads(state_text)
            
            # Extract RAG Sections
            sections_marker = "Relevant rulebook sections:"
            if sections_marker in user_prompt:
                start_idx = user_prompt.find(sections_marker) + len(sections_marker)
                json_start = user_prompt.find("[", start_idx)
                if json_start != -1:
                    json_end = user_prompt.rfind("]", json_start)
                    sections_text = user_prompt[json_start:json_end+1]
                    sections = json.loads(sections_text)
        except Exception as e:
            print(f"MockProvider parsing error: {e}")
            # Fallback: if parsing fails, we might still have a question to answer

        q_lower = question.lower()
        tracks = snapshot.get("latest_tracks", [])

        if any(word in q_lower for word in ["what is", "identify", "target", "drone", "aircraft", "status", "risky"]):
            if not tracks:
                return (
                    "Monitoring summary: no active tracks in the current operational picture. "
                    "All monitored sectors report routine background activity."
                )
            main = tracks[0]
            tid = main.get("target_id", "UNKNOWN")
            lvl = str(main.get("threat_level", "green")).upper()
            pos = main.get("position", {})
            sensors = ", ".join(main.get("source_sensors", []))
            return (
                f"Track {tid} is at {lvl} with fusion confidence {main.get('fusion_confidence', 'n/a')}. "
                f"Position: {pos.get('altitude_m')} m altitude, {pos.get('speed_mps')} m/s. "
                f"Contributing sensors: {sensors or 'none'}. "
                f"Classification: {main.get('classification', 'unknown')}. "
                f"{main.get('explanation', '')}"
            )

        if any(word in q_lower for word in ["threat", "anomaly", "alert", "why", "explain"]):
            alerts = snapshot.get("alerts", [])
            if alerts:
                latest = alerts[-1]
                trace = latest.get("explanation_trace") or []
                trace_text = "\n- ".join(trace) if trace else latest.get("explanation", "")
                return (
                    f"Latest alert ({latest.get('level', '').upper()}): {latest.get('title')}.\n"
                    f"Reasoning:\n- {trace_text}\n"
                    f"Recommended operator action: {latest.get('recommended_action')}"
                )
            if tracks:
                top = max(tracks, key=lambda t: t.get("threat_score", 0))
                return (
                    f"No new alert this tick. Highest monitored track is {top.get('target_id')} "
                    f"at {str(top.get('threat_level', 'green')).upper()} "
                    f"(score {top.get('threat_score', 0)}).\n{format_trace_for_llm(top)}"
                )
            return "No elevated threats in the current state. Continue routine monitoring."

        if any(word in q_lower for word in ["do", "action", "procedure", "respond", "protocol", "operator"]):
            rule_text = ""
            if sections:
                rule_text = f" Rulebook reference: {sections[0].get('heading', 'defensive monitoring')}."
            if tracks and str(tracks[0].get("threat_level", "")).lower() == "red":
                return (
                    f"Defensive operator guidance:{rule_text} Escalate to senior operator, "
                    "maintain continuous multi-sensor tracking, notify site security per local protocol, "
                    "and document all evidence. This system does not execute countermeasures."
                )
            return (
                f"Defensive operator guidance:{rule_text} Continue correlating sensors, "
                "verify identity where possible, and increase monitoring priority if the track approaches "
                "the restricted zone."
            )

        return (
            "SkyShield AI Copilot (explanation only): ask about a specific track, the latest alert, "
            "or recommended defensive operator actions. Detection and scoring are performed by the fusion "
            "and threat engines — I explain their outputs."
        )


class OllamaProvider(BaseProvider):
    provider_name = "ollama"

    def __init__(self, model: str, base_url: str, timeout_seconds: int) -> None:
        super().__init__(model=model)
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def chat(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.base_url}/chat"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
        }
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        return data.get("message", {}).get("content", "").strip() or "No response returned by model."


class DefensiveCopilot:
    def __init__(self, retriever: RulebookRetriever) -> None:
        self.retriever = retriever
        provider = settings.llm_provider
        if provider == "ollama":
            self.provider: BaseProvider = OllamaProvider(
                model=settings.llm_model,
                base_url=settings.llm_base_url,
                timeout_seconds=settings.llm_timeout_seconds,
            )
        else:
            self.provider = MockProvider(model=settings.llm_model)

    def _safe_chat(self, user_prompt: str) -> Dict[str, Any]:
        warning = None
        try:
            answer = self.provider.chat(DEFENSIVE_SYSTEM_PROMPT, user_prompt)
        except Exception as exc:
            warning = f"Fell back to mock response because the provider call failed: {exc}"
            fallback = MockProvider(model=settings.llm_model)
            answer = fallback.chat(DEFENSIVE_SYSTEM_PROMPT, user_prompt)
        return {
            "provider": self.provider.provider_name,
            "model": self.provider.model,
            "answer": answer,
            "warning": warning,
        }

    def summarize(self, snapshot: Dict[str, Any], focus: Optional[str] = None) -> Dict[str, Any]:
        sections = self.retriever.search("incident summary alert response restricted zone", top_k=3)
        prompt = self._build_summary_prompt(snapshot, sections, focus=focus)
        result = self._safe_chat(prompt)
        result["grounded_sections"] = sections
        return result

    def ask(self, question: str, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        sections = self.retriever.search(question, top_k=3)
        prompt = self._build_question_prompt(question, snapshot, sections)
        result = self._safe_chat(prompt)
        result["grounded_sections"] = sections
        return result

    def explain_alert(self, alert: Dict[str, Any], track: Dict[str, Any]) -> Dict[str, Any]:
        sections = self.retriever.search("alert explanation threat score", top_k=2)
        trace = alert.get("explanation_trace") or track.get("explanation_trace") or []
        prompt = (
            "Explain this defensive monitoring alert in plain language.\n\n"
            f"Alert:\n{json.dumps(alert, indent=2)}\n\n"
            f"Track:\n{json.dumps(track, indent=2)}\n\n"
            f"Explanation trace:\n{json.dumps(trace, indent=2)}\n\n"
            f"Relevant rulebook sections:\n{json.dumps(sections, indent=2)}\n"
        )
        result = self._safe_chat(prompt)
        if result.get("provider") == "mock":
            result["answer"] = (
                f"{alert.get('title')}: {alert.get('explanation')}\n\n"
                f"{format_trace_for_llm(track)}\n\n"
                f"Operator action: {alert.get('recommended_action')}"
            )
        result["grounded_sections"] = sections
        return result

    def _build_summary_prompt(
        self, snapshot: Dict[str, Any], sections: List[Dict[str, str]], focus: Optional[str] = None
    ) -> str:
        return (
            "Create a concise defensive incident summary for an operator.\n"
            f"Focus: {focus or 'overall incident'}\n\n"
            f"Current system state:\n{json.dumps(snapshot, indent=2)}\n\n"
            f"Relevant rulebook sections:\n{json.dumps(sections, indent=2)}\n\n"
            "Format the answer with: Overview, Top Risk, Evidence, Recommended Defensive Action."
        )

    def _build_question_prompt(
        self, question: str, snapshot: Dict[str, Any], sections: List[Dict[str, str]]
    ) -> str:
        return (
            "Answer the operator question using only the current state and rulebook excerpts.\n\n"
            f"Question: {question}\n\n"
            f"Current system state:\n{json.dumps(snapshot, indent=2)}\n\n"
            f"Relevant rulebook sections:\n{json.dumps(sections, indent=2)}\n\n"
            "Be specific, defensive, and grounded."
        )
