"""
Upload endpoints for images.
POST /api/v1/upload
Accepts multipart/form-data files and uploads them to Supabase Storage.
Returns JSON with list of public URLs for successfully uploaded images.
"""
from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, File, UploadFile, HTTPException

from ..supabase_storage import upload_bytes_as_public_url

logger = logging.getLogger("j1.upload")

router = APIRouter(prefix="/api/v1", tags=["Upload"])


@router.post("/upload")
async def upload_files(files: List[UploadFile] | None = File(None)):
    if not files:
        raise HTTPException(status_code=400, detail={"success": False, "data": None, "error": "No files provided"})

    urls: List[str] = []
    for f in files:
        try:
            content = await f.read()
            url = await upload_bytes_as_public_url(content, original_filename=f.filename, content_type=f.content_type)
            if url:
                urls.append(url)
            else:
                logger.warning("File skipped or failed: %s", f.filename)
        except Exception as exc:
            logger.exception("Failed to process upload for %s: %s", f.filename, exc)
            continue

    return {"success": True, "data": {"urls": urls}}
