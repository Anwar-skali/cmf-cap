from app.core.config import Settings


def test_sqlite_development_uris():
    s = Settings(ENVIRONMENT="development", DATABASE_URL=None)
    assert s.get_db_uri(sync=False) == "sqlite+aiosqlite:///./cmf.db"
    assert s.get_db_uri(sync=True) == "sqlite:///./cmf.db"


def test_neon_postgres_url_transformation():
    neon_url = "postgres://user:pass@ep-cool-db.neon.tech/neondb?sslmode=require"
    s = Settings(ENVIRONMENT="production", DATABASE_URL=neon_url)
    assert s.get_db_uri(sync=False) == "postgresql+asyncpg://user:pass@ep-cool-db.neon.tech/neondb?sslmode=require"
    assert s.get_db_uri(sync=True) == "postgresql+psycopg2://user:pass@ep-cool-db.neon.tech/neondb?sslmode=require"


def test_standard_postgresql_url_transformation():
    pg_url = "postgresql://user:pass@localhost:5432/cmf_platform"
    s = Settings(ENVIRONMENT="production", DATABASE_URL=pg_url)
    assert s.get_db_uri(sync=False) == "postgresql+asyncpg://user:pass@localhost:5432/cmf_platform"
    assert s.get_db_uri(sync=True) == "postgresql+psycopg2://user:pass@localhost:5432/cmf_platform"


def test_production_fallback_credentials():
    s = Settings(
        ENVIRONMENT="production",
        DATABASE_URL=None,
        POSTGRES_USER="myuser",
        POSTGRES_PASSWORD="mypassword",
        POSTGRES_HOST="myhost",
        POSTGRES_PORT=5432,
        POSTGRES_DB="mydb",
    )
    assert s.get_db_uri(sync=False) == "postgresql+asyncpg://myuser:mypassword@myhost:5432/mydb"
    assert s.get_db_uri(sync=True) == "postgresql+psycopg2://myuser:mypassword@myhost:5432/mydb"


def test_cors_origins_parsing():
    s1 = Settings(CORS_ORIGINS='["https://cmf.vercel.app", "https://cmf.up.railway.app"]')
    assert "https://cmf.vercel.app" in s1.CORS_ORIGINS
    assert "https://cmf.up.railway.app" in s1.CORS_ORIGINS

    s2 = Settings(CORS_ORIGINS="https://cmf.vercel.app, https://cmf.up.railway.app")
    assert "https://cmf.vercel.app" in s2.CORS_ORIGINS
    assert "https://cmf.up.railway.app" in s2.CORS_ORIGINS
