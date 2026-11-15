"""Deciding whether a photo shows the target word. Shared by the service and the word test."""

from dataclasses import dataclass

from .detector import Detection


def normalize(label: str) -> str:
    """Labels compare case-insensitively and without surrounding spaces."""
    return label.strip().lower()


@dataclass(frozen=True)
class Verdict:
    detected: bool
    #: Best score of the target among the detections; None when it wasn't seen.
    confidence: float | None


def verdict(detections: list[Detection], target: str) -> Verdict:
    """Is `target` among the detections, and how sure is the best one?"""
    want = normalize(target)
    best = max((d.confidence for d in detections if normalize(d.label) == want), default=None)
    return Verdict(detected=best is not None, confidence=best)
