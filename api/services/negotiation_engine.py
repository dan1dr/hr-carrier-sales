"""Deterministic negotiation decision engine — broker perspective.

Platform already computed: offered_rate, followup_rate, ceiling_rate.
This takes those + the carrier's counter price + round number and returns
accept / counter / reject / escalate.

  $0 ── offered ── followup ── ceiling ──── ∞
        instant     R0 counter   best&final  WALK AWAY
        accept      (concede)    (last try)
"""

from api.models.schemas import EvaluateOfferRequest, EvaluateOfferResponse


def evaluate_offer(req: EvaluateOfferRequest) -> EvaluateOfferResponse:
    offer = req.carrier_offer
    rnd = req.round_number
    offered = req.offered_rate
    followup = req.followup_rate
    ceiling = req.ceiling_rate

    # ── carrier asks ≤ offered → instant accept ─────────────────────
    if offer <= offered:
        return EvaluateOfferResponse(
            decision="accept",
            explanation_text=f"${offer:,.0f} works for us. Let me get you set up with dispatch.",
        )

    # ── carrier asks ≤ followup → accept ────────────────────────────
    if offer <= followup:
        return EvaluateOfferResponse(
            decision="accept",
            explanation_text=f"${offer:,.0f} works for us. Let me get you set up with dispatch.",
        )

    # ── carrier asks between followup and ceiling ───────────────────
    if offer <= ceiling:
        if rnd == 0:
            return EvaluateOfferResponse(
                decision="counter",
                counter_rate=followup,
                explanation_text=f"I can do ${followup:,.0f}. That's a strong rate for this lane and timing.",
            )
        return EvaluateOfferResponse(
            decision="accept",
            explanation_text=f"${offer:,.0f} works for us. Let me get you set up with dispatch.",
        )

    # ── carrier asks above ceiling ──────────────────────────────────
    if rnd == 0:
        return EvaluateOfferResponse(
            decision="counter",
            counter_rate=followup,
            explanation_text=f"I understand you're looking for more, but the best I can do right now is ${followup:,.0f}.",
        )
    if rnd == 1:
        return EvaluateOfferResponse(
            decision="counter",
            counter_rate=ceiling,
            explanation_text=f"My absolute best is ${ceiling:,.0f}. If that works, I can get you booked right now.",
        )
    return EvaluateOfferResponse(
        decision="reject",
        explanation_text=f"My best and final is ${ceiling:,.0f}. I can't go higher than that on this lane.",
    )
