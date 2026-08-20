import secrets
import smtplib
import asyncio
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

def generate_otp_code() -> str:
    """Generate a secure 6-digit numeric OTP code."""
    return f"{secrets.randbelow(900000) + 100000}"

def _send_smtp_sync(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    """Synchronous SMTP helper to run in threadpool executor."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL or settings.SMTP_USER}>"
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if settings.SMTP_PORT == 465 and not settings.SMTP_TLS:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(msg["From"], [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(msg["From"], [to_email], msg.as_string())

        print(f" [ZenWill Email] OTP successfully sent via SMTP to {to_email}")
        return True
    except Exception as e:
        print(f" [ZenWill Email Error] Failed to send email via SMTP to {to_email}: {e}")
        return False

async def send_otp_email(to_email: str, otp_code: str) -> bool:
    """
    Send OTP verification code via SMTP if configured, or print to console for development.
    """
    print(f"\n========================================================")
    print(f" [ZenWill Security OTP] Code for {to_email}: {otp_code}")
    print(f" Valid for 10 minutes.")
    print(f"========================================================\n")

    # If SMTP credentials are configured in .env, send actual email asynchronously
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        subject = f"Your ZenWill Verification Code: {otp_code}"
        text_content = f"Your ZenWill security verification code is {otp_code}. It is valid for 10 minutes."
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #070709; color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #1E2024;">
            <h2 style="color: #00A8FF; font-size: 24px; margin-bottom: 8px;">ZenWill Verification</h2>
            <p style="color: #A0A5B1; font-size: 14px; margin-bottom: 24px;">Use the code below to complete your security verification.</p>
            <div style="background: #111215; border: 1px solid #00A8FF44; text-align: center; padding: 20px; border-radius: 10px; margin-bottom: 24px;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #00A8FF;">{otp_code}</span>
            </div>
            <p style="color: #717684; font-size: 12px;">This code is valid for 10 minutes. If you did not request this code, please ignore this email.</p>
        </div>
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, _send_smtp_sync, to_email, subject, html_content, text_content
        )

    return True
