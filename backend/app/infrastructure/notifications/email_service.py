from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import aiosmtplib

    HAS_AIOSMTP = True
except ImportError:
    HAS_AIOSMTP = False


class EmailService:
    def __init__(self) -> None:
        self._host = settings.SMTP_HOST
        self._port = settings.SMTP_PORT
        self._user = settings.SMTP_USER
        self._password = settings.SMTP_PASSWORD
        self._use_tls = settings.SMTP_USE_TLS

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html: bool = False,
    ) -> bool:
        if not HAS_AIOSMTP:
            logger.warning(
                "aiosmtplib not installed. Email sending disabled. "
                "Install with: pip install aiosmtplib"
            )
            return False
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = self._user or "noreply@cmf-platform.com"
            msg["To"] = to
            msg["Subject"] = subject
            content_type = "html" if html else "plain"
            msg.attach(MIMEText(body, content_type, "utf-8"))
            smtp_args = {
                "hostname": self._host,
                "port": self._port,
                "username": self._user if self._user else None,
                "password": self._password if self._password else None,
                "use_tls": self._use_tls,
            }
            if not smtp_args["username"]:
                smtp_args.pop("username")
                smtp_args.pop("password")
            await aiosmtplib.send(msg, **smtp_args)
            logger.info("Email sent to %s: %s", to, subject)
            return True
        except Exception as exc:
            logger.error(
                "Failed to send email to %s: %s", to, str(exc)
            )
            return False

    async def send_password_reset(
        self, email: str, token: str
    ) -> bool:
        reset_url = (
            f"{settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else 'http://localhost:3000'}"
            f"/reset-password?token={token}"
        )
        subject = "Password Reset Request"
        body = f"""
        <html>
        <body>
        <h2>Password Reset</h2>
        <p>You have requested to reset your password.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
        </body>
        </html>
        """
        return await self.send_email(
            to=email, subject=subject, body=body, html=True
        )

    async def send_notification(
        self, user_email: str, title: str, message: str
    ) -> bool:
        subject = title
        body = f"""
        <html>
        <body>
        <h2>{title}</h2>
        <p>{message}</p>
        </body>
        </html>
        """
        return await self.send_email(
            to=user_email, subject=subject, body=body, html=True
        )
