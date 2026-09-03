from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.models.user import User
from app.models.journal import JournalEntry
from app.schemas.journal import JournalEntryCreate, JournalEntryResponse, JournalEntryUpdate
from app.middleware.auth_middleware import get_current_user
from app.services.mind_profile_service import get_or_create_mind_profile, record_journal_entry

router = APIRouter(prefix="/journal", tags=["Journal"])


@router.post("/", response_model=JournalEntryResponse, status_code=201)
async def create_journal_entry(
    payload: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
):
    entry = JournalEntry(
        user_id=str(current_user.id),
        author_name=current_user.name or "Anonymous Member",
        title=payload.title,
        content=payload.content,
        prompt_used=payload.prompt_used,
        mood_tag=payload.mood_tag,
        energy_tag=payload.energy_tag,
        emotional_tags=payload.emotional_tags or [],
        is_private=payload.is_private if payload.is_private is not None else False,
    )
    await entry.insert()

    try:
        profile = await get_or_create_mind_profile(current_user)
        await record_journal_entry(profile)
    except Exception as e:
        print(f"Mind profile update notice: {e}")

    return _to_response(entry)


@router.get("/", response_model=List[JournalEntryResponse])
async def list_journal_entries(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
):
    entries = await JournalEntry.find(
        JournalEntry.user_id == str(current_user.id)
    ).sort(-JournalEntry.created_at).skip(offset).limit(limit).to_list()

    return [_to_response(e) for e in entries]


@router.get("/community/recent", response_model=List[JournalEntryResponse])
async def list_recent_community_entries(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
):
    entries = await JournalEntry.find(
        JournalEntry.is_private == False
    ).sort(-JournalEntry.created_at).limit(limit).to_list()

    return [_to_response(e) for e in entries]


@router.get("/{entry_id}", response_model=JournalEntryResponse)
async def get_journal_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
):
    entry = await JournalEntry.find_one(JournalEntry.id == entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if entry.is_private and entry.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Private journal entry")
    return _to_response(entry)


@router.patch("/{entry_id}", response_model=JournalEntryResponse)
async def update_journal_entry(
    entry_id: str,
    payload: JournalEntryUpdate,
    current_user: User = Depends(get_current_user),
):
    entry = await JournalEntry.find_one(
        JournalEntry.id == entry_id,
        JournalEntry.user_id == str(current_user.id),
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    if payload.title is not None:
        entry.title = payload.title
    if payload.content is not None:
        entry.content = payload.content
    if payload.mood_tag is not None:
        entry.mood_tag = payload.mood_tag
    if payload.emotional_tags is not None:
        entry.emotional_tags = payload.emotional_tags
    if payload.is_private is not None:
        entry.is_private = payload.is_private

    await entry.save()
    return _to_response(entry)


@router.delete("/{entry_id}", status_code=204)
async def delete_journal_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
):
    entry = await JournalEntry.find_one(
        JournalEntry.id == entry_id,
        JournalEntry.user_id == str(current_user.id),
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    await entry.delete()


def _to_response(entry: JournalEntry) -> JournalEntryResponse:
    return JournalEntryResponse(
        id=str(entry.id),
        user_id=entry.user_id,
        author_name=entry.author_name or "Anonymous Member",
        title=entry.title,
        content=entry.content,
        prompt_used=entry.prompt_used,
        mood_tag=entry.mood_tag,
        emotional_tags=entry.emotional_tags or [],
        ai_themes=entry.ai_themes or [],
        ai_insight=entry.ai_insight,
        is_private=entry.is_private,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )
