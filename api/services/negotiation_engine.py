"""Deterministic negotiation policy engine — broker perspective.

We are the broker. The carrier is our COST. Lower = better for us.
The loadboard_rate is the market anchor.

    open_rate    = loadboard × open_pct     (our aggressive first counter)
    ceiling_rate = loadboard × ceiling_pct  (absolute max we'll ever pay)

  ┌─────────────────────────────────────────────────────────────────┐
  │  ← we want to be here              we don't want to be here →  │
  │                                                                 │
  │  $0 ── open_rate ──── loadboard ──── ceiling ──── ∞            │
  │        R0 counter       anchor        WALK AWAY                │
  │        └────── we concede upward reluctantly ──────┘           │
  └─────────────────────────────────────────────────────────────────┘

Per-tier strategy ($2,300 loadboard example):
  new      open=85% ($1,955)  ceiling=100% ($2,300)  → tight, conservative
  verified open=90% ($2,070)  ceiling=103% ($2,369)  → moderate flexibility
  premium  open=93% ($2,139)  ceiling=107% ($2,461)  → fair, reward loyalty

Round progression:
  R0 → counter near open_rate (aggressive lowball)
  R1 → concede a bit toward ceiling (new: barely, premium: more)
  R2 → final offer approaching ceiling (new: still conservative)

If carrier asks ≤ open_rate → instant accept (they're cheaper than our opener!)
If carrier asks > ceiling → reject / escalate

LLM for conversation, deterministic policy for money.
"""

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
            tier="new", open_pct=0.85, ceiling_pct=1.00, max_rounds=3,
            urgency_boost_pct=0.03, escalation_sensitivity="high",
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


async def _get_tier(db: AsyncSession, mc_number: str | None) -> str:
    if not mc_number:
        return "new"
    result = await db.execute(
        select(CarrierRow.tier).where(CarrierRow.mc_number == mc_number)
    )
    tier = result.scalar_one_or_none()
    return tier or "new"


def _margin_pct(agreed_rate: float, loadboard_rate: float) -> float:
    """Positive = we pay less than loadboard (good). Negative = overpaying."""
    if loadboard_rate == 0:
        return 0.0
    return round(((loadboard_rate - agreed_rate) / loadboard_rate) * 100, 1)


def _counter_for_round(
    rnd: int, max_rounds: int, open_rate: float, ceiling_rate: float
) -> float:
    """Compute our counter-offer for a given round.

    Starts at open_rate (aggressive) and concedes upward toward ceiling.
    The concession curve is exponential — early rounds barely move,
    later rounds concede more, but we never exceed ceiling.

    Example (new tier, loadboard=$2,300, open=$1,955, ceiling=$2,300, gap=$345):
      R0 → 0%  of gap → $1,955  (aggressive opener)
      R1 → 30% of gap → $2,059  (small concession)
      R2 → 70% of gap → $2,197  (larger concession, still below loadboard)
    """
    if max_rounds <= 1:
        return (open_rate + ceiling_rate) / 2

    t = rnd / (max_rounds - 1)  # 0.0 → 1.0
    # Quadratic curve: slow to concede early, faster later
    concession = t * t
    # Scale by 0.7 so even the final round doesn't hit ceiling exactly
    # (keeps a bit of margin in reserve; escalate if carrier still won't budge)
    concession = concession * 0.85

    gap = ceiling_rate - open_rate
    return open_rate + gap * concession


async def evaluate_offer(
    db: AsyncSession, req: EvaluateOfferRequest
) -> EvaluateOfferResponse:
    tier = req.carrier_tier or await _get_tier(db, req.mc_number)
    config = await _get_config(db, tier)
    loadboard_rate = await _get_loadboard_rate(db, req.load_id)

    open_rate = loadboard_rate * config.open_pct
    ceiling_rate = loadboard_rate * config.ceiling_pct
    offer = req.carrier_offer
    rnd = req.round_number
    max_rounds = config.max_rounds
    sentiment = (req.carrier_sentiment or "").lower()

    decision: str
    counter_rate: float | None = None
    reason_code: str
    explanation: str

    # ── ACCEPT: carrier asks at or below our opening price ──────────────
    # They want less than what we were going to offer — take it!
    if offer <= open_rate:
        decision = "accept"
        reason_code = "below_open"
        explanation = (
            f"${offer:,.0f} works for us. "
            "Let me get you set up with dispatch."
        )

    # ── REJECT / ESCALATE: carrier asks above our ceiling ───────────────
    elif offer > ceiling_rate:
        if sentiment in ("frustrated", "angry") or rnd >= max_rounds - 1:
            decision = "escalate"
            reason_code = "above_ceiling"
            explanation = (
                "Let me bring in one of our senior reps to see if we "
                "can work something out."
            )
        else:
            decision = "counter"
            reason_code = "above_ceiling_counter"
            # Still counter at our current round's rate — show them our number
            counter_rate = round(_counter_for_round(rnd, max_rounds, open_rate, ceiling_rate))
            explanation = (
                f"I understand you're looking for more, but the best I "
                f"can do right now is ${counter_rate:,.0f}."
            )

    # ── COUNTER ZONE: between open_rate and ceiling ─────────────────────
    else:
        our_number = round(_counter_for_round(rnd, max_rounds, open_rate, ceiling_rate))

        # If our computed counter is at or above what the carrier is asking,
        # just accept their offer — no point countering higher than their ask.
        if our_number >= offer:
            decision = "accept"
            counter_rate = None
            reason_code = "within_range"
            explanation = (
                f"${offer:,.0f} works for us. "
                "Let me get you set up with dispatch."
            )
        elif sentiment in ("frustrated", "angry") and rnd >= 1:
            decision = "escalate"
            counter_rate = None
            reason_code = "carrier_frustrated"
            explanation = (
                "Let me bring in one of our senior reps — I want to make "
                "sure we find something that works for both of us."
            )
        elif rnd >= max_rounds - 1:
            counter_rate = our_number
            decision = "counter"
            reason_code = "final_offer"
            explanation = (
                f"My absolute best is ${counter_rate:,.0f}. "
                "If that works, I can get you booked right now."
            )
        else:
            counter_rate = our_number
            decision = "counter"
            reason_code = "counter_offer"
            explanation = (
                f"I can do ${counter_rate:,.0f} — that's a competitive "
                "rate for this lane and pickup window."
            )

    # ── Persist & return ────────────────────────────────────────────────
    agreed = offer if decision == "accept" else counter_rate
    margin = _margin_pct(agreed, loadboard_rate) if agreed else None

    offer_row = OfferRow(
        call_id=req.call_id,
        round_number=rnd,
        carrier_offer=offer,
        agent_counter=counter_rate,
        decision=decision,
        reason_code=reason_code,
        floor_rate=open_rate,
        target_rate=ceiling_rate,
    )
    db.add(offer_row)
    await db.commit()

    return EvaluateOfferResponse(
        decision=decision,
        counter_rate=counter_rate,
        reason_code=reason_code,
        explanation_text=explanation,
        floor_hit=offer > ceiling_rate,
        round=rnd,
        margin_retained_pct=margin,
    )
