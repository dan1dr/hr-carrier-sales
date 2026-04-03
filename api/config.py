from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_key: str = "dev-api-key"
    database_url: str = "sqlite+aiosqlite:///./data/carrier_sales.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    azure_storage_connection_string: str = ""
    azure_storage_container: str = "carrier-sales-events"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
