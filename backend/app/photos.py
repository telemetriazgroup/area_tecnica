import uuid
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

MAX_BYTES = 8 * 1024 * 1024


def save_image(upload: UploadFile) -> str:
    raw = upload.file.read(MAX_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=400, detail="La foto está vacía.")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="La foto supera 8 MB.")
    try:
        image = Image.open(BytesIO(raw))
        image = ImageOps.exif_transpose(image)
        image.thumbnail((1600, 1600))
        if image.mode in {"RGBA", "LA", "P"}:
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.split()[-1])
            image = background
        else:
            image = image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="No se pudo leer la foto. Usa JPG o PNG.") from exc

    filename = f"{uuid.uuid4().hex}.jpg"
    destination = Path(settings.media_dir) / filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "JPEG", quality=82, optimize=True)
    return filename


def photo_path(filename: str) -> Path:
    path = (Path(settings.media_dir) / filename).resolve()
    root = Path(settings.media_dir).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(status_code=404, detail="No se encontró la foto.")
    return path


def remove_file(filename: str) -> None:
    path = Path(settings.media_dir) / filename
    if path.is_file():
        path.unlink()
