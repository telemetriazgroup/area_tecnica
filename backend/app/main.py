import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import audit, auth, backup, catalog, operations, reports, technicians, users
from app.seed import seed

logger = logging.getLogger("area_tecnica")


def wait_for_db() -> None:
    last_error: Exception | None = None
    for _ in range(30):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return
        except Exception as exc:
            last_error = exc
            time.sleep(1)
    raise RuntimeError("No se pudo conectar a Postgres") from last_error


@asynccontextmanager
async def lifespan(_: FastAPI):
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
    import app.models  # noqa: F401

    wait_for_db()
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_parts_model_description "
                "ON spare_parts (model_id, lower(description))"
            )
        )
    with SessionLocal() as session:
        seed(session)
    yield


app = FastAPI(title="Área técnica", lifespan=lifespan)

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = exc.errors()
    location = ""
    if errors:
        location = ".".join(str(part) for part in errors[0].get("loc", []) if part not in {"body", "query", "form"})
    detail = f"Revisa el campo {location}." if location else "Revisa los datos. Hay campos incompletos o inválidos."
    return JSONResponse(status_code=422, content={"detail": detail})


@app.get("/api/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"ok": True}


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(technicians.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(operations.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
