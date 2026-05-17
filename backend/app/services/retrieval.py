from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Dict, List, Optional
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False


@dataclass
class Section:
    heading: str
    content: str
    embedding: Optional[np.ndarray] = None


class RulebookRetriever:
    def __init__(self, path: str, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.path = Path(path)
        self.sections: List[Section] = self._load_sections()
        self.model_name = model_name
        self.model = None
        self._model_failed = False
        
        # We don't load the model in init to avoid blocking the main thread/startup
        # It will be loaded lazily on the first search
    
    def _lazy_load_model(self) -> None:
        if self.model or self._model_failed or not HAS_SENTENCE_TRANSFORMERS:
            return
            
        try:
            print(f"Loading embedding model {self.model_name}...")
            self.model = SentenceTransformer(self.model_name)
            self._compute_embeddings()
            print("Embedding model loaded successfully.")
        except Exception as e:
            print(f"Failed to load embedding model: {e}. Falling back to keyword search.")
            self._model_failed = True
            self.model = None

    def _load_sections(self) -> List[Section]:
        if not self.path.exists():
            return [Section(heading="No Rulebook Loaded", content="No rulebook file was found.")]
        text = self.path.read_text(encoding="utf-8")
        parts = re.split(r"^##\s+", text, flags=re.MULTILINE)
        sections: List[Section] = []
        if parts and not parts[0].strip().startswith("#"):
            parts = parts[1:]
        for part in parts:
            lines = [line.rstrip() for line in part.splitlines() if line.strip()]
            if not lines:
                continue
            heading = lines[0].strip()
            content = "\n".join(lines[1:]).strip() or "No content."
            sections.append(Section(heading=heading, content=content))
        if not sections:
            sections.append(Section(heading="Rulebook", content=text.strip()))
        return sections

    def _compute_embeddings(self) -> None:
        if not self.model:
            return
        
        texts = [f"{s.heading}\n{s.content}" for s in self.sections]
        embeddings = self.model.encode(texts)
        for i, section in enumerate(self.sections):
            section.embedding = embeddings[i]

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, str]]:
        self._lazy_load_model()
        if self.model:
            return self._vector_search(query, top_k)
        return self._keyword_search(query, top_k)

    def _vector_search(self, query: str, top_k: int = 3) -> List[Dict[str, str]]:
        query_embedding = self.model.encode([query])[0]
        
        scores = []
        for section in self.sections:
            if section.embedding is not None:
                # Cosine similarity
                sim = np.dot(query_embedding, section.embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(section.embedding)
                )
                scores.append((sim, section))
            else:
                scores.append((0.0, section))
        
        scores.sort(key=lambda x: x[0], reverse=True)
        top = [s for score, s in scores[:top_k]]
        return [{"heading": item.heading, "content": item.content} for item in top]

    def _keyword_search(self, query: str, top_k: int = 3) -> List[Dict[str, str]]:
        terms = [t.lower() for t in re.findall(r"[a-zA-Z0-9_-]+", query)]
        scored = []
        for section in self.sections:
            haystack = f"{section.heading}\n{section.content}".lower()
            score = sum(haystack.count(term) for term in terms)
            scored.append((score, section))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = [s for score, s in scored[:top_k] if score > 0]
        if not top:
            top = self.sections[:top_k]
        return [{"heading": item.heading, "content": item.content} for item in top]
