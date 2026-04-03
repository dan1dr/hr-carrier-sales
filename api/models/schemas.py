"""Pydantic request/response schemas for the API."""

from datetime import datetime
from pydantic import BaseModel, Field, field_validator, model_validator


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
# Round number is never sent by the client — it is resolved server-side
# from (mc_number, load_id) session state.

class EvaluateOfferRequest(BaseModel):
    carrier_offer: float
    offered_rate: float
    followup_rate: float
    ceiling_rate: float
    mc_number: str
    load_id: str

    @field_validator("mc_number", "load_id", mode="before")
    @classmethod
    def require_mc_load(cls, v):
        out = _empty_to_none(v)
        if out is None:
            raise ValueError("mc_number and load_id are required")
        return str(out).strip()

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
    round_number: int = 0


# ── Call Logging ────────────────────────────────────────────────────────────

_SENTIMENT_MAP = {
    -2: "frustrated",
    -1: "negative",
    0: "neutral",
    1: "positive",
    2: "positive",
}


class LogCallRequest(BaseModel):
    call_id: str | None = None
    caller_name: str | None = None
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
    outcome: str = "unknown"
    sentiment_score: int | None = None
    sentiment_reasoning: str | None = None
    outcome_reasoning: str | None = None
    offered_rate: float | None = None
    carrier_last_price: float | None = None
    handoff_required: bool = False
    call_duration_seconds: int | None = None
    summary: str | None = None
    timedate: str | None = None
    p90_latency: float | None = None
    miles: float | None = None

    @field_validator("verified", mode="before")
    @classmethod
    def coerce_verified_bool(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return v

    @field_validator("handoff_required", mode="before")
    @classmethod
    def coerce_handoff_bool(cls, v):
        if isinstance(v, str) and not v.strip():
            return False
        return v

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases_and_coerce(cls, values):
        if not isinstance(values, dict):
            return values
        v = dict(values)
        if v.get("carrier_name") is not None and v.get("caller_name") is None:
            v["caller_name"] = v.pop("carrier_name")
        if v.get("origin") is not None and v.get("requested_origin") is None:
            v["requested_origin"] = v["origin"]
        if v.get("destination") is not None and v.get("requested_destination") is None:
            v["requested_destination"] = v["destination"]
        if "duration" in v and v.get("call_duration_seconds") is None:
            v["call_duration_seconds"] = v["duration"]
        o = v.get("outcome")
        if o is None or _empty_to_none(o) is None or str(o).strip() in ("0",):
            v["outcome"] = "unknown"
        nullable_numeric = (
            "loadboard_rate", "initial_carrier_ask", "final_rate",
            "offered_rate", "carrier_last_price", "margin_retained_pct",
            "sentiment_score", "call_duration_seconds", "p90_latency", "miles",
        )
        for field in nullable_numeric:
            fv = v.get(field)
            if isinstance(fv, str) and not fv.strip():
                v[field] = None
        if isinstance(v.get("negotiation_rounds"), str) and not v["negotiation_rounds"].strip():
            v["negotiation_rounds"] = 0
        return v

    def resolve_sentiment(self) -> str | None:
        """Map sentiment_score to a label."""
        if self.sentiment_score is not None:
            return _SENTIMENT_MAP.get(self.sentiment_score, "neutral")
        return None


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
    total_call_minutes: float | None = None
    avg_call_duration_seconds: float | None = None
    outcome_breakdown: dict[str, int] = {}
    sentiment_breakdown: dict[str, int] = {}


class NegotiationConfig(BaseModel):
    tier: str
    open_pct: float = 0.85
    ceiling_pct: float = 1.00
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
