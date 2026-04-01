"""Pydantic request/response schemas for the API."""

from datetime import datetime
from pydantic import BaseModel, Field


# ── Loads ───────────────────────────────────────────────────────────────────

class LoadSearchRequest(BaseModel):
    origin: str
    destination: str | None = None
    equipment_type: str | None = None
    pickup_date: str | None = None
    delivery_date: str | None = None
    weight: float | None = None
    miles: float | None = None
    load_id: str | None = None


class LoadMatch(BaseModel):
    load_id: str
    origin: str
    destination: str
    pickup_datetime: datetime
    delivery_datetime: datetime
    equipment_type: str
    loadboard_rate: float
    miles: float | None = None
    weight: float | None = None
    commodity_type: str | None = None
    score: float
    reason_codes: list[str]


class LoadSearchResponse(BaseModel):
    matches: list[LoadMatch]
    recommended: str | None = None
    total_matches: int


# ── Negotiation ─────────────────────────────────────────────────────────────

class EvaluateOfferRequest(BaseModel):
    call_id: str
    load_id: str
    carrier_offer: float
    round_number: int = Field(ge=0, le=3)
    mc_number: str | None = None
    carrier_sentiment: str | None = None


class EvaluateOfferResponse(BaseModel):
    decision: str  # accept | counter | reject | escalate
    counter_rate: float | None = None
    reason_code: str
    explanation_text: str
    floor_hit: bool = False
    round: int
    margin_retained_pct: float | None = None


# ── Call Logging ────────────────────────────────────────────────────────────

class LogCallRequest(BaseModel):
    call_id: str | None = None
    carrier_name: str | None = None
    mc_number: str | None = None
    legal_name: str | None = None
    verified: bool | None = None
    carrier_tier: str | None = None
    requested_origin: str | None = None
    requested_destination: str | None = None
    equipment_type: str | None = None
    recommended_load_id: str | None = None
    loadboard_rate: float | None = None
    initial_carrier_ask: float | None = None
    counter_offers: list[float] | None = None
    final_rate: float | None = None
    negotiation_rounds: int = 0
    margin_retained_pct: float | None = None
    outcome: str  # booked | no_match | declined_by_carrier | failed_verification | escalated | dropped
    sentiment: str | None = None
    handoff_required: bool = False
    call_duration_seconds: int | None = None
    summary: str | None = None


class LogCallResponse(BaseModel):
    call_id: str
    status: str = "logged"


# ── Dashboard ───────────────────────────────────────────────────────────────

class DashboardMetrics(BaseModel):
    total_calls: int = 0
    verified_carriers: int = 0
    matched_loads: int = 0
    entered_negotiation: int = 0
    booked: int = 0
    avg_margin_pct: float | None = None
    avg_negotiation_rounds: float | None = None
    outcome_breakdown: dict[str, int] = {}
    sentiment_breakdown: dict[str, int] = {}


class NegotiationConfig(BaseModel):
    tier: str
    floor_pct: float = 0.85
    target_pct: float = 0.97
    max_rounds: int = 3
    urgency_boost_pct: float = 0.05
    escalation_sensitivity: str = "medium"
