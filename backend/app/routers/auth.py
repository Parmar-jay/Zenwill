import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from app.config import settings
from app.models.user import User
from app.models.mind_profile import MindProfile
from app.middleware.auth_middleware import get_current_user
from app.services.account_purger import purge_user_data_permanently
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    TokenRefreshResponse,
    OtpRequestPayload,
    OtpVerifyPayload,
    GoogleAuthRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    DeleteAccountRequest,
)
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.services.email_service import generate_otp_code, send_otp_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def handle_user_scheduled_deletion_check(user: User):
    """
    Check if user is scheduled for deletion:
    - If >= 7 days: Permanently purge all data and raise HTTP 403.
    - If < 7 days: Automatically cancel deletion upon relogin!
    """
    if user.is_scheduled_for_deletion:
        if user.deletion_scheduled_at:
            now = datetime.utcnow()
            days_passed = (now - user.deletion_scheduled_at).days
            if days_passed >= 7:
                await purge_user_data_permanently(user)
                raise HTTPException(
                    status_code=403,
                    detail="Your account has been permanently deleted after the 7-day grace period."
                )
        
        # Less than 7 days: cancel deletion process automatically on relogin!
        user.is_scheduled_for_deletion = False
        user.deletion_scheduled_at = None
        user.deletion_reason = None
        await user.save()
        print(f"[ZenWill Deletion] Relogin detected for {user.email}. Scheduled account deletion CANCELLED.")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest):
    email = payload.email.lower().strip()
    # Check if email already exists
    existing = await User.find_one(User.email == email)
    if existing:
        if existing.email_verified:
            raise HTTPException(status_code=400, detail="This email address is already registered. Please log in.")
        else:
            # Overwrite unverified account details and send new OTP
            existing.hashed_password = hash_password(payload.password)
            existing.name = payload.name or email.split("@")[0]
            otp_code = generate_otp_code()
            existing.otp_code = otp_code
            existing.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
            await existing.save()
            await send_otp_email(existing.email, otp_code)
            return {
                "message": f"Verification code sent to {existing.email}",
                "email": existing.email
            }

    otp_code = generate_otp_code()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        name=payload.name or email.split("@")[0],
        is_onboarded=False,
        onboarding_step=0,
        email_verified=False,
        otp_code=otp_code,
        otp_expires_at=expires_at,
    )
    await user.insert()

    # Create default mind profile
    profile = MindProfile(user_id=str(user.id))
    await profile.insert()

    await send_otp_email(email, otp_code)

    return {
        "message": f"Verification code sent to {email}",
        "email": email
    }


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = await User.find_one(User.email == email)

    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email address.")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password. Please check and try again.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Please contact support.")
    if not user.email_verified:
        # Generate new OTP code and send to verify
        otp_code = generate_otp_code()
        user.otp_code = otp_code
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
        await user.save()
        await send_otp_email(user.email, otp_code)
        raise HTTPException(status_code=403, detail="email_unverified")

    # Check if user is scheduled for deletion; if < 7 days, auto-cancel deletion!
    await handle_user_scheduled_deletion_check(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    user.refresh_token = refresh_token
    await user.save()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        name=user.name,
        email=user.email,
        is_onboarded=user.is_onboarded,
        onboarding_step=user.onboarding_step,
        streak=user.streak,
        max_streak=user.max_streak,
        total_points=user.total_points,
        mind_strength=user.mind_strength,
        last_checkin_date=user.last_checkin_date,
    )


@router.post("/request-otp")
async def request_otp(payload: OtpRequestPayload):
    """Generate a 6-digit OTP and send to the specified email."""
    email = payload.email.lower().strip()
    otp_code = generate_otp_code()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    user = await User.find_one(User.email == email)
    if not user:
        # Create a placeholder user document awaiting OTP verification
        user = User(
            email=email,
            hashed_password="",
            name=email.split("@")[0],
            is_onboarded=False,
            onboarding_step=0,
            otp_code=otp_code,
            otp_expires_at=expires_at,
        )
        await user.insert()
        profile = MindProfile(user_id=str(user.id))
        await profile.insert()
    else:
        user.otp_code = otp_code
        user.otp_expires_at = expires_at
        await user.save()

    await send_otp_email(email, otp_code)

    return {
        "message": f"OTP successfully sent to {email}",
        "email": email,
        "expires_in_minutes": 10,
    }


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(payload: OtpVerifyPayload):
    """Verify 6-digit OTP code and return authentication JWT token."""
    email = payload.email.lower().strip()
    user = await User.find_one(User.email == email)

    if not user:
        raise HTTPException(status_code=404, detail="User not found for this email")

    if not user.otp_code or user.otp_code != payload.code:
        raise HTTPException(status_code=400, detail="Invalid OTP verification code")

    if not user.otp_expires_at or datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP code has expired. Please request a new code.")

    # Clear OTP after successful verification
    user.otp_code = None
    user.otp_expires_at = None
    user.email_verified = True

    if payload.name:
        user.name = payload.name

    # Check if user is scheduled for deletion; if < 7 days, auto-cancel deletion!
    await handle_user_scheduled_deletion_check(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    user.refresh_token = refresh_token
    await user.save()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        name=user.name,
        email=user.email,
        is_onboarded=user.is_onboarded,
        onboarding_step=user.onboarding_step,
        streak=user.streak,
        max_streak=user.max_streak,
        total_points=user.total_points,
        mind_strength=user.mind_strength,
        last_checkin_date=user.last_checkin_date,
    )


@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(payload: RefreshRequest):
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = decoded.get("sub")
    user = await User.find_one(User.id == user_id)

    if not user or user.refresh_token != payload.refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token revoked or invalid")

    access_token = create_access_token({"sub": str(user.id)})
    return TokenRefreshResponse(access_token=access_token)


async def verify_google_token(token: str) -> dict:
    """Verify Google Access token or ID token using Google's APIs."""
    async with httpx.AsyncClient() as client:
        # Check Userinfo API first (for OAuth2 access tokens)
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0
        )
        if resp.status_code == 200:
            return resp.json()

        # Fallback to Tokeninfo API (for ID tokens)
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={token}",
            timeout=10.0
        )
        if resp.status_code == 200:
            return resp.json()

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired Google authentication token"
        )


@router.post("/google", response_model=TokenResponse)
async def google_auth(payload: GoogleAuthRequest):
    """Authenticate or register user via verified Google OAuth identity."""
    email = payload.email.lower().strip() if payload.email else ""
    name = payload.name

    if payload.id_token:
        try:
            google_info = await verify_google_token(payload.id_token)
            if google_info.get("email"):
                email = google_info["email"].lower().strip()
            if google_info.get("name"):
                name = google_info["name"]
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Could not verify Google authentication token")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required for Google authentication")

    user = await User.find_one(User.email == email)

    if not user:
        # Register new Google user
        display_name = name or email.split("@")[0].capitalize()
        user = User(
            email=email,
            hashed_password="",
            name=display_name,
            is_onboarded=False,
            onboarding_step=0,
        )
        await user.insert()
        profile = MindProfile(user_id=str(user.id))
        await profile.insert()
    else:
        if name and not user.name:
            user.name = name

    # Check if user is scheduled for deletion; if < 7 days, auto-cancel deletion!
    await handle_user_scheduled_deletion_check(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    user.refresh_token = refresh_token
    await user.save()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        name=user.name,
        email=user.email,
        is_onboarded=user.is_onboarded,
        onboarding_step=user.onboarding_step,
        streak=user.streak,
        max_streak=user.max_streak,
        total_points=user.total_points,
        mind_strength=user.mind_strength,
        last_checkin_date=user.last_checkin_date,
    )


@router.post("/delete-account-request")
async def delete_account_request(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
):
    """Schedule account for deletion in 7 days after verifying password."""
    if current_user.hashed_password:
        if not verify_password(payload.password, current_user.hashed_password):
            raise HTTPException(
                status_code=400,
                detail="Incorrect password. Please enter your valid password to confirm account deletion."
            )

    current_user.is_scheduled_for_deletion = True
    current_user.deletion_scheduled_at = datetime.utcnow()
    current_user.deletion_reason = payload.deletion_reason or "Unspecified reason"
    await current_user.save()

    return {
        "success": True,
        "message": "Account deletion scheduled. Your account will be permanently deleted in 7 days. Logging in within 7 days will automatically cancel deletion.",
        "deletion_scheduled_at": current_user.deletion_scheduled_at.isoformat(),
    }


@router.post("/forgot-password/request")
async def forgot_password_request(payload: ForgotPasswordRequest):
    email = payload.email.lower().strip()
    user = await User.find_one(User.email == email)
    if not user:
        raise HTTPException(status_code=404, detail="No user found with this email address")

    otp_code = generate_otp_code()
    user.otp_code = otp_code
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    await user.save()

    await send_otp_email(email, otp_code)
    return {
        "success": True,
        "message": f"Verification code sent to {email}"
    }


@router.post("/forgot-password/reset")
async def forgot_password_reset(payload: ResetPasswordRequest):
    email = payload.email.lower().strip()
    user = await User.find_one(User.email == email)
    if not user:
        raise HTTPException(status_code=404, detail="No user found with this email address")

    if not user.otp_code or user.otp_code != payload.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    if not user.otp_expires_at or datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    # Reset password and clear OTP
    user.hashed_password = hash_password(payload.new_password)
    user.otp_code = None
    user.otp_expires_at = None
    user.email_verified = True
    await user.save()

    return {
        "success": True,
        "message": "Password reset successfully. You can now log in."
    }


@router.post("/logout")
async def logout(refresh_token: str = ""):
    return {"message": "Logged out successfully"}


