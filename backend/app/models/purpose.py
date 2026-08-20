import uuid
from datetime import datetime
from beanie import Document, Indexed
from pydantic import Field, BaseModel


class LifePurpose(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Indexed(str, unique=True)
    purpose_1: str = Field(default="")
    purpose_2: str = Field(default="")
    purpose_3: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "life_purposes"


class PurposeUpdateRequest(BaseModel):
    purpose_1: str
    purpose_2: str
    purpose_3: str


class PurposeResponse(BaseModel):
    user_id: str
    purpose_1: str
    purpose_2: str
    purpose_3: str
    updated_at: datetime
