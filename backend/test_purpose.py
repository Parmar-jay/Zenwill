import asyncio
from app.database import init_db
from app.models.purpose import LifePurpose


async def main():
    await init_db()
    print("Database initialized successfully!")
    doc = await LifePurpose.find_one({"user_id": "test_123"})
    print("Find result:", doc)
    if not doc:
        doc = LifePurpose(
            user_id="test_123",
            purpose_1="Wisdom test",
            purpose_2="Soul test",
            purpose_3="Legacy test",
        )
        await doc.insert()
        print("Inserted new purpose doc:", doc)

    fetched = await LifePurpose.find_one({"user_id": "test_123"})
    print("Fetched inserted doc:", fetched)


if __name__ == "__main__":
    asyncio.run(main())
