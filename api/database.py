import uuid
from datetime import datetime

from sqlalchemy import Boolean, Integer, Float, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from api.config import settings


class Base(DeclarativeBase):
    pass


# ── Tables ──────────────────────────────────────────────────────────────────

class LoadRow(Base):
    __tablename__ = "loads"

    load_id: Mapped[str] = mapped_column(Text, primary_key=True)
    origin_city: Mapped[str] = mapped_column(Text, nullable=False)
    origin_state: Mapped[str] = mapped_column(Text, nullable=False)
    origin_lat: Mapped[float | None] = mapped_column(Float)
    origin_lng: Mapped[float | None] = mapped_column(Float)
    dest_city: Mapped[str] = mapped_column(Text, nullable=False)
    dest_state: Mapped[str] = mapped_column(Text, nullable=False)
    dest_lat: Mapped[float | None] = mapped_column(Float)
    dest_lng: Mapped[float | None] = mapped_column(Float)
    pickup_datetime: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    delivery_datetime: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    equipment_type: Mapped[str] = mapped_column(Text, nullable=False)
    loadboard_rate: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    weight: Mapped[float | None] = mapped_column(Float)
    commodity_type: Mapped[str | None] = mapped_column(Text)
    num_of_pieces: Mapped[int | None] = mapped_column(Integer)
    miles: Mapped[float | None] = mapped_column(Float)
    dimensions: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="available")


class CarrierRow(Base):
    __tablename__ = "carriers"

    mc_number: Mapped[str] = mapped_column(Text, primary_key=True)
    dot_number: Mapped[str | None] = mapped_column(Text)
    legal_name: Mapped[str | None] = mapped_column(Text)
    carrier_status: Mapped[str | None] = mapped_column(Text)
    insurance_status: Mapped[str | None] = mapped_column(Text)
    safety_rating: Mapped[str | None] = mapped_column(Text)
    out_of_service: Mapped[bool] = mapped_column(Boolean, default=False)
    eligible_to_book: Mapped[bool] = mapped_column(Boolean, default=False)
    tier: Mapped[str] = mapped_column(Text, default="new")
    cached_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CallRow(Base):
    __tablename__ = "calls"

    call_id: Mapped[str] = mapped_column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    mc_number: Mapped[str | None] = mapped_column(Text, ForeignKey("carriers.mc_number"))
    carrier_name: Mapped[str | None] = mapped_column(Text)
    requested_origin: Mapped[str | None] = mapped_column(Text)
    requested_destination: Mapped[str | None] = mapped_column(Text)
    equipment_type: Mapped[str | None] = mapped_column(Text)
    recommended_load_id: Mapped[str | None] = mapped_column(Text, ForeignKey("loads.load_id"))
    loadboard_rate: Mapped[float | None] = mapped_column(Float)
    initial_carrier_ask: Mapped[float | None] = mapped_column(Float)
    final_rate: Mapped[float | None] = mapped_column(Float)
    negotiation_rounds: Mapped[int] = mapped_column(Integer, default=0)
    margin_retained_pct: Mapped[float | None] = mapped_column(Float)
    outcome: Mapped[str] = mapped_column(Text, nullable=False)
    sentiment: Mapped[str | None] = mapped_column(Text)
    handoff_required: Mapped[bool] = mapped_column(Boolean, default=False)
    call_duration_seconds: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class OfferRow(Base):
    __tablename__ = "offers"

    offer_id: Mapped[str] = mapped_column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    call_id: Mapped[str] = mapped_column(Text, ForeignKey("calls.call_id"), nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    carrier_offer: Mapped[float] = mapped_column(Float, nullable=False)
    agent_counter: Mapped[float | None] = mapped_column(Float)
    decision: Mapped[str] = mapped_column(Text, nullable=False)
    reason_code: Mapped[str | None] = mapped_column(Text)
    floor_rate: Mapped[float | None] = mapped_column(Float)
    target_rate: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EventRow(Base):
    __tablename__ = "events"

    event_id: Mapped[str] = mapped_column(Text, primary_key=True, default=lambda: str(uuid.uuid4()))
    call_id: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class NegotiationConfigRow(Base):
    __tablename__ = "negotiation_configs"

    tier: Mapped[str] = mapped_column(Text, primary_key=True)
    floor_pct: Mapped[float] = mapped_column(Float, default=0.85)
    target_pct: Mapped[float] = mapped_column(Float, default=0.97)
    max_rounds: Mapped[int] = mapped_column(Integer, default=3)
    urgency_boost_pct: Mapped[float] = mapped_column(Float, default=0.05)
    escalation_sensitivity: Mapped[str] = mapped_column(Text, default="medium")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Engine / Session ────────────────────────────────────────────────────────

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session
