"""Pydantic request/response schemas for the API."""

from datetime import datetime
from pydantic import BaseModel, Field, field_validator


def _empty_to_none(v):
    """HappyRobot / JSON templates often send '' for missing optional fields."""
    if v is None:
        return None
    if isinstance(v, str) and not v.strip():
        return None
    return v


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

    @field_validator("weight", "miles", mode="before")
    @classmethod
    def optional_floats_coerce(cls, v):
        return _empty_to_none(v)

    @field_validator("destination", "equipment_type", "pickup_date", "delivery_date", "load_id", mode="before")
    @classmethod
    def optional_strings_trim_empty(cls, v):
        out = _empty_to_none(v)
        return out


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
# Platform computes offered/followup/ceiling. This endpoint only decides
# what to do when the carrier counters with a price.

class EvaluateOfferRequest(BaseModel):
    carrier_offer: float
    round_number: int = Field(default=0, ge=0, le=2)
    offered_rate: float
    followup_rate: float
    ceiling_rate: float

    @field_validator("round_number", mode="before")
    @classmethod
    def coerce_round_number(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return 0
        return int(v)

    @field_validator("carrier_offer", "offered_rate", "followup_rate", "ceiling_rate", mode="before")
    @classmethod
    def coerce_floats(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return 0.0
        return float(v)


class EvaluateOfferResponse(BaseModel):
    decision: str  # accept | counter | reject | escalate
    counter_rate: float | None = None
    explanation_text: str


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
    open_pct: float = 0.85
    ceiling_pct: float = 1.00
    max_rounds: int = 3
    urgency_boost_pct: float = 0.05
    escalation_sensitivity: str = "medium"
    offered_rate_override: float | None = None


# ── Pricing Params (called by platform before computing rates) ──────────

class PricingParamsRequest(BaseModel):
    tier: str = "new"

    @field_validator("tier", mode="before")
    @classmethod
    def coerce_tier(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return "new"
        return v.strip().lower()


class PricingParamsResponse(BaseModel):
    tier: str
    open_pct: float
    ceiling_pct: float
    offered_rate_override: float | None = None
