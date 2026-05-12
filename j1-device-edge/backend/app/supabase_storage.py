"""
Supabase Storage helper for uploading image bytes and returning public URLs.
"""
from __future__ import annotations

import logging
import os
import mimetypes
from uuid import uuid4
from typing import Optional

import httpx

from .config import settings

logger = logging.getLogger("j1.supabase")


def _safe_extension(filename: str, content_type: Optional[str]) -> str:
    """Return a safe extension including the leading dot."""
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1]
        if len(ext) <= 8:
            return f".{ext}"
    if content_type:
        guess = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if guess:
            return guess
    return ".jpg"


def _is_allowed_content_type(content_type: str) -> bool:
    if not content_type:
        return False
    return content_type.startswith("image/")


async def upload_bytes_as_public_url(
    data: bytes, original_filename: Optional[str] = None, content_type: Optional[str] = None
) -> Optional[str]:
    """
    Upload raw bytes to Supabase Storage 'reports' bucket and return the public URL.
    Returns None on failure.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        logger.warning("Supabase not configured; skipping upload")
        return None

    # validate content type
    ct = (content_type or mimetypes.guess_type(original_filename or "")[0]) or "application/octet-stream"
    if not _is_allowed_content_type(ct):
        logger.warning("Rejected non-image content type: %s", ct)
        return None

    if settings.SUPABASE_MAX_UPLOAD_SIZE and len(data) > settings.SUPABASE_MAX_UPLOAD_SIZE:
        logger.warning("Rejected file larger than max size: %d > %d", len(data), settings.SUPABASE_MAX_UPLOAD_SIZE)
        return None

    # generate filename
    ext = _safe_extension(original_filename or "file", ct)
    filename = f"{uuid4().hex}{ext}"
    bucket = settings.SUPABASE_REPORTS_BUCKET

    upload_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{filename}"

    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Content-Type": ct,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.put(upload_url, content=data, headers=headers)
        if resp.status_code not in (200, 201):
            logger.error("Supabase upload failed: %s %s", resp.status_code, resp.text)
            return None

        public_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{bucket}/{filename}"
        logger.info("Uploaded file to Supabase: %s -> %s", filename, public_url)
        return public_url
    except Exception as exc:
        logger.exception("Supabase upload exception: %s", exc)
        return None
