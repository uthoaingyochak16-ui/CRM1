from urllib.parse import quote_plus
from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # No defaults on secrets — this forces every real value (DB password, JWT
    # secret, admin password) to come from your local .env file only, which is
    # git-ignored. Never hardcode a real credential here in config.py, since
    # this file IS committed to source control.
    database_url: str = ""
    db_host: str = ""
    db_port: int = 5432
    db_name: str = ""
    db_user: str = ""
    db_password: str = ""
    jwt_secret: str
    initial_admin_email: str
    initial_admin_password: str
    sslcommerz_store_id: str = ""
    sslcommerz_store_password: str = ""
    sslcommerz_is_sandbox: bool = True
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    initial_admin_name: str = "Super Admin"
    cors_origins: str = "http://localhost:5173"
    public_base_url: str = "http://localhost:8000"
    upload_dir: str = "uploads"
    environment: str = "development"
    allowed_hosts: str = "localhost,127.0.0.1"
    password_min_length: int = 10
    login_rate_limit: int = 5
    login_rate_window_seconds: int = 300
    reset_rate_limit: int = 3
    reset_rate_window_seconds: int = 900
    auto_initialize_database: bool = True

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def build_container_database_url(self):
        # If a complete DATABASE_URL is already supplied explicitly, preserve it.
        if not self.database_url and self.db_host and self.db_name and self.db_user:
            self.database_url = (
                f"postgresql+psycopg://{quote_plus(self.db_user)}:{quote_plus(self.db_password)}"
                f"@{self.db_host}:{self.db_port}/{quote_plus(self.db_name)}"
            )
        if self.environment.lower() == "production":
            insecure_values = {"change_me", "changeme", "secret", "dev-secret"}
            if len(self.jwt_secret) < 32 or self.jwt_secret.lower() in insecure_values:
                raise ValueError("JWT_SECRET must be a random value of at least 32 characters in production")
            if len(self.initial_admin_password) < self.password_min_length:
                raise ValueError("INITIAL_ADMIN_PASSWORD does not satisfy PASSWORD_MIN_LENGTH")
            if not self.public_base_url.startswith("https://"):
                raise ValueError("PUBLIC_BASE_URL must use https:// in production")
            if any("localhost" in origin or "127.0.0.1" in origin for origin in self.cors_origin_list):
                raise ValueError("CORS_ORIGINS cannot contain localhost in production")
        return self

    @field_validator("password_min_length")
    @classmethod
    def validate_password_min_length(cls, value: int) -> int:
        if value < 10:
            raise ValueError("PASSWORD_MIN_LENGTH cannot be less than 10")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_origin_regex(self) -> str:
        if self.environment.lower() == "production":
            return r"(?!)"
        return r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

    @property
    def allowed_host_list(self) -> list[str]:
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]


settings = Settings()
