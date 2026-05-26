from __future__ import annotations

from sqlalchemy import Column, String, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class StoreSnapshot(Base):
    __tablename__ = "store"

    key = Column(String(50), primary_key=True, index=True)
    value = Column(Text, nullable=False)
