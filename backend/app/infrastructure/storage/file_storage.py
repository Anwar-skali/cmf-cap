from __future__ import annotations

import mimetypes
import os
import uuid
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from app.core.config import settings

ALLOWED_EXTENSIONS: set[str] = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".csv",
    ".json",
    ".xml",
    ".zip",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".step",
    ".stp",
    ".igs",
    ".iges",
    ".dwg",
    ".dxf",
}

EXTENSION_TO_MIME: dict[str, set[str]] = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".xls": {"application/vnd.ms-excel"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    ".ppt": {"application/vnd.ms-powerpoint"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation"},
    ".txt": {"text/plain"},
    ".csv": {"text/csv", "text/plain"},
    ".json": {"application/json"},
    ".xml": {"application/xml", "text/xml"},
    ".zip": {"application/zip"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".gif": {"image/gif"},
    ".svg": {"image/svg+xml"},
    ".step": {"application/step"},
    ".stp": {"application/step"},
    ".igs": {"application/iges"},
    ".iges": {"application/iges"},
    ".dwg": {"application/acad"},
    ".dxf": {"application/dxf"},
}


class FileStorageService:
    def __init__(self, upload_dir: str | None = None) -> None:
        self._upload_dir = Path(upload_dir or settings.UPLOAD_DIR)
        self._upload_dir.mkdir(parents=True, exist_ok=True)

    async def save_file(
        self, file: UploadFile, subdirectory: str = ""
    ) -> str:
        if not self._validate_extension(file.filename):
            raise ValueError(
                f"File extension not allowed: {file.filename}. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )
        self._validate_mime_type(file.filename, file.content_type)
        content = await file.read()
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise ValueError(
                f"File size exceeds maximum allowed size of "
                f"{settings.MAX_UPLOAD_SIZE / (1024 * 1024):.1f} MB"
            )
        ext = Path(file.filename).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        target_dir = self._upload_dir
        if subdirectory:
            target_dir = target_dir / subdirectory
            target_dir.mkdir(parents=True, exist_ok=True)
        file_path = target_dir / unique_name
        with open(file_path, "wb") as f:
            f.write(content)
        relative_path = str(
            Path(subdirectory) / unique_name if subdirectory else unique_name
        )
        return relative_path

    async def delete_file(self, file_path: str) -> bool:
        full_path = self._upload_dir / file_path
        if not full_path.exists():
            return False
        try:
            os.remove(full_path)
            self._remove_empty_parent_dirs(full_path.parent)
            return True
        except OSError:
            return False

    async def get_file_path(self, file_path: str) -> str:
        full_path = self._upload_dir / file_path
        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        return str(full_path)

    async def file_exists(self, file_path: str) -> bool:
        return (self._upload_dir / file_path).exists()

    def _validate_extension(self, filename: str | None) -> bool:
        if filename is None or "." not in filename:
            return False
        ext = Path(filename).suffix.lower()
        return ext in ALLOWED_EXTENSIONS

    def _validate_mime_type(self, filename: str | None, content_type: str | None) -> None:
        if filename is None or "." not in filename:
            return
        ext = Path(filename).suffix.lower()
        allowed_mimes = EXTENSION_TO_MIME.get(ext)
        if allowed_mimes and content_type and content_type not in allowed_mimes:
            raise ValueError(
                f"MIME type '{content_type}' does not match extension '{ext}'. "
                f"Expected one of: {', '.join(sorted(allowed_mimes))}"
            )

    def _remove_empty_parent_dirs(self, path: Path) -> None:
        for parent in path.parents:
            if parent == self._upload_dir:
                break
            try:
                if not any(parent.iterdir()):
                    parent.rmdir()
            except (OSError, PermissionError):
                break
