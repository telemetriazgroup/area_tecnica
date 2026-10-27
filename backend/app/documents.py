import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import settings
from app.photos import remove_file

MAX_PDF = 20 * 1024 * 1024


def save_pdf(upload: UploadFile) -> tuple[str, str]:
    raw = upload.file.read(MAX_PDF + 1)
    if not raw:
        raise HTTPException(status_code=400, detail="El PDF está vacío.")
    if len(raw) > MAX_PDF:
        raise HTTPException(status_code=400, detail="El manual supera 20 MB.")
    if not raw.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF.")
    filename = f"{uuid.uuid4().hex}.pdf"
    destination = Path(settings.media_dir) / filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(raw)
    original = (upload.filename or "manual.pdf").replace("\\", "/").split("/")[-1].strip()
    original = original[:180] or "manual.pdf"
    if not original.lower().endswith(".pdf"):
        original = f"{original}.pdf"
    return filename, original


def replace_pdf(previous: str | None, upload: UploadFile) -> tuple[str, str]:
    filename, original = save_pdf(upload)
    if previous:
        remove_file(previous)
    return filename, original
