"""Seed the database with initial data from JSON files."""

import asyncio
import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, func, text

from api.database import (
    engine, async_session, Base,
    LoadRow, CarrierRow, NegotiationConfigRow,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_FK_DROPS = [
    "ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_mc_number_fkey",
    "ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_recommended_load_id_fkey",
]


async def _apply_migrations():
    """Drop stale foreign keys that block logging calls for unknown carriers/loads."""
    async with engine.begin() as conn:
        for stmt in _FK_DROPS:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass


async def seed():
    await _apply_migrations()

    async with async_session() as db:
        try:
            load_count = (await db.execute(select(func.count(LoadRow.load_id)))).scalar() or 0
            if load_count > 0:
                print(f"Database already has {load_count} loads — skipping seed.")
                return
        except Exception:
            pass

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        with open(DATA_DIR / "seed_loads.json") as f:
            for item in json.load(f):
                item["pickup_datetime"] = datetime.fromisoformat(item["pickup_datetime"])
                item["delivery_datetime"] = datetime.fromisoformat(item["delivery_datetime"])
                db.add(LoadRow(**item))

        with open(DATA_DIR / "seed_carriers.json") as f:
            for item in json.load(f):
                db.add(CarrierRow(**item))

        with open(DATA_DIR / "seed_negotiation_configs.json") as f:
            for item in json.load(f):
                db.add(NegotiationConfigRow(**item))

        await db.commit()
        print("Seeded: 30 loads, 4 carriers, 3 negotiation configs.")


if __name__ == "__main__":
    asyncio.run(seed())
