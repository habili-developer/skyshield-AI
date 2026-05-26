from __future__ import annotations

from alembic import context

from backend.app.config import settings
from backend.app.database.models import OperationalBase


config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = OperationalBase.metadata


def run_migrations_offline() -> None:
    context.configure(url=settings.database_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    from backend.app.database.session import get_engine

    with get_engine().connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
