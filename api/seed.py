"""Seed the database with initial data from JSON files."""

import asyncio
import json
from datetime import datetime
from pathlib import Path

from api.database import (
    engine, async_session, Base,
    LoadRow, CarrierRow, NegotiationConfigRow,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        existing = (await db.execute(
            __import__("sqlalchemy").select(LoadRow.load_id)
        )).scalars().all()
        if existing:
            print(f"Database already has {len(existing)} loads — skipping seed.")
            return

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
