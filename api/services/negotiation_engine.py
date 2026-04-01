"""Deterministic negotiation policy engine. LLM for conversation, policy for money."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import CarrierRow, LoadRow, NegotiationConfigRow, OfferRow
from api.models.schemas import EvaluateOfferRequest, EvaluateOfferResponse


async def _get_config(db: AsyncSession, tier: str) -> NegotiationConfigRow:
    result = await db.execute(
        select(NegotiationConfigRow).where(NegotiationConfigRow.tier == tier)
    )
    config = result.scalar_one_or_none()
    if config is None:
        return NegotiationConfigRow(
            tier="new", floor_pct=0.85, target_pct=0.97, max_rounds=3,
            urgency_boost_pct=0.05, escalation_sensitivity="medium",
        )
    return config


async def _get_loadboard_rate(db: AsyncSession, load_id: str) -> float:
    result = await db.execute(
        select(LoadRow.loadboard_rate).where(LoadRow.load_id == load_id)
    )
    rate = result.scalar_one_or_none()
    if rate is None:
        raise ValueError(f"Load {load_id} not found")
    return rate


def _margin_pct(agreed_rate: float, loadboard_rate: float) -> float:
    if loadboard_rate == 0:
        return 0.0
    return round(((loadboard_rate - agreed_rate) / loadboard_rate) * 100, 1)


async def _get_tier(db: AsyncSession, mc_number: str | None) -> str:
    if not mc_number:
        return "new"
    result = await db.execute(
        select(CarrierRow.tier).where(CarrierRow.mc_number == mc_number)
    )
    tier = result.scalar_one_or_none()
    return tier or "new"


async def evaluate_offer(db: AsyncSession, req: EvaluateOfferRequest) -> EvaluateOfferResponse:
    tier = await _get_tier(db, req.mc_number)
    config = await _get_config(db, tier)
    loadboard_rate = await _get_loadboard_rate(db, req.load_id)

    floor_rate = loadboard_rate * config.floor_pct
    target_rate = loadboard_rate * config.target_pct
    offer = req.carrier_offer
    rnd = req.round_number

    decision: str
    counter_rate: float | None = None
    reason_code: str
    explanation: str
    floor_hit = False

    if offer < floor_rate:
        decision = "reject"
        reason_code = "below_floor"
        floor_hit = True
        explanation = (
            f"I appreciate the offer, but ${offer:,.0f} is below what we can do on this lane. "
            f"The best I can offer is ${floor_rate * 1.02:,.0f}."
        )
    elif rnd <= 1:
        if offer >= target_rate:
            decision = "accept"
            reason_code = "within_target_band"
            explanation = f"${offer:,.0f} works for us. Let me get you set up with dispatch."
        else:
            decision = "counter"
            counter_rate = round((target_rate + offer) / 2)
            reason_code = "midpoint_counter"
            explanation = f"I can come up to ${counter_rate:,.0f} — that's a competitive rate for this lane and pickup window."
    elif rnd == 2:
        threshold = target_rate * 0.97
        if offer >= threshold:
            decision = "accept"
            reason_code = "within_target_band"
            explanation = f"${offer:,.0f} works for us. Let me get you connected with dispatch."
        elif req.carrier_sentiment == "frustrated" and offer >= floor_rate * 1.05:
            decision = "escalate"
            reason_code = "carrier_frustrated_close_to_floor"
            explanation = "Let me bring in one of our senior reps — I want to make sure we find something that works for both of us."
        else:
            decision = "counter"
            counter_rate = round(floor_rate + (target_rate - floor_rate) * 0.3)
            reason_code = "aggressive_counter"
            explanation = f"The best I can do is ${counter_rate:,.0f}. That's a solid rate for this lane."
    else:  # round 3
        final_floor = floor_rate * 1.02
        if offer >= final_floor:
            decision = "accept"
            reason_code = "final_round_accept"
            explanation = f"Alright, ${offer:,.0f} — let's make it happen. I'll transfer you to dispatch."
        else:
            decision = "reject"
            counter_rate = round(final_floor)
            reason_code = "final_offer"
            floor_hit = offer < floor_rate
            explanation = (
                f"My absolute best is ${final_floor:,.0f}. "
                "If that works, I can get you booked right now. Otherwise, I understand."
            )

    agreed = offer if decision == "accept" else counter_rate
    margin = _margin_pct(agreed, loadboard_rate) if agreed else None

    offer_row = OfferRow(
        call_id=req.call_id,
        round_number=rnd,
        carrier_offer=offer,
        agent_counter=counter_rate,
        decision=decision,
        reason_code=reason_code,
        floor_rate=floor_rate,
        target_rate=target_rate,
    )
    db.add(offer_row)
    await db.commit()

    return EvaluateOfferResponse(
        decision=decision,
        counter_rate=counter_rate,
        reason_code=reason_code,
        explanation_text=explanation,
        floor_hit=floor_hit,
        round=rnd,
        margin_retained_pct=margin,
    )
