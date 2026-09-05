from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uuid
from datetime import datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    name: Optional[str]
    email: str
    is_onboarded: bool
    onboarding_step: int
    streak: int = 0
    max_streak: int = 0
    total_points: int = 0
    xp: int = 0
    mind_strength: int = 50
    email_verified: bool = True
    last_checkin_date: Optional[str] = None
    last_retain_date: Optional[str] = None
    last_retain_status: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OtpRequestPayload(BaseModel):
    email: EmailStr


class OtpVerifyPayload(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    name: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    id_token: Optional[str] = None
    google_id: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)


class DeleteAccountRequest(BaseModel):
    password: str
    deletion_reason: Optional[str] = "Taking a break"




