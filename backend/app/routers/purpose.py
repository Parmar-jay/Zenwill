from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from app.models.user import User
from app.models.purpose import LifePurpose, PurposeUpdateRequest, PurposeResponse
from app.middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/purpose", tags=["Purpose"])


@router.get("", response_model=PurposeResponse)
async def get_user_purpose(current_user: User = Depends(get_current_user)):
    """Fetch the 3 main life purposes of the authenticated user."""
    user_id_str = str(current_user.id)
    purpose_doc = await LifePurpose.find_one(LifePurpose.user_id == user_id_str)
    if not purpose_doc:
        purpose_doc = LifePurpose(
            user_id=user_id_str,
            purpose_1="",
            purpose_2="",
            purpose_3="",
        )
        await purpose_doc.insert()

    return PurposeResponse(
        user_id=str(purpose_doc.user_id),
        purpose_1=purpose_doc.purpose_1 or "",
        purpose_2=purpose_doc.purpose_2 or "",
        purpose_3=purpose_doc.purpose_3 or "",
        updated_at=purpose_doc.updated_at,
    )


@router.put("", response_model=PurposeResponse)
async def update_user_purpose(
    req: PurposeUpdateRequest, current_user: User = Depends(get_current_user)
):
    """Update the 3 main life purposes of the authenticated user."""
    user_id_str = str(current_user.id)
    purpose_doc = await LifePurpose.find_one(LifePurpose.user_id == user_id_str)
    if not purpose_doc:
        purpose_doc = LifePurpose(
            user_id=user_id_str,
            purpose_1=req.purpose_1.strip(),
            purpose_2=req.purpose_2.strip(),
            purpose_3=req.purpose_3.strip(),
            updated_at=datetime.utcnow(),
        )
        await purpose_doc.insert()
    else:
        purpose_doc.purpose_1 = req.purpose_1.strip()
        purpose_doc.purpose_2 = req.purpose_2.strip()
        purpose_doc.purpose_3 = req.purpose_3.strip()
        purpose_doc.updated_at = datetime.utcnow()
        await purpose_doc.save()

    return PurposeResponse(
        user_id=str(purpose_doc.user_id),
        purpose_1=purpose_doc.purpose_1 or "",
        purpose_2=purpose_doc.purpose_2 or "",
        purpose_3=purpose_doc.purpose_3 or "",
        updated_at=purpose_doc.updated_at,
    )
