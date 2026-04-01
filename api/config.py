from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_key: str = "dev-api-key"
    database_url: str = "sqlite+aiosqlite:///./data/carrier_sales.db"
    fmcsa_api_key: str = ""
    fmcsa_mock_mode: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
