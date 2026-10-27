from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://area:area@localhost:5432/area_tecnica"
    jwt_secret: str = "dev-secret-change"
    jwt_hours: int = 168
    media_dir: str = "media"
    timezone: str = "America/Lima"
    cors_origins: str = "http://localhost:8080,http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
