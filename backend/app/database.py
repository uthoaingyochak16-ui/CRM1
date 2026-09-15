from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

database_url = settings.database_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql+psycopg2://"):
    database_url = database_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)

engine_kwargs = {"pool_pre_ping": True}
if database_url.startswith("postgresql"):
    engine_kwargs["connect_args"] = {"prepare_threshold": None}
    engine_kwargs.update(
        pool_size=20,
        max_overflow=30,
        pool_timeout=10,
        pool_recycle=1800,
    )

engine = create_engine(database_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

from .realtime import install_session_listeners

install_session_listeners()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
