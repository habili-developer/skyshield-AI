"""operational history tables

Revision ID: 0001_operational_history
Revises:
Create Date: 2026-05-17
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_operational_history"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sensor_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.String(length=120), nullable=False),
        sa.Column("target_id", sa.String(length=120), nullable=False),
        sa.Column("sensor_type", sa.String(length=40), nullable=False),
        sa.Column("tick", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "tracks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("target_id", sa.String(length=120), nullable=False),
        sa.Column("tick", sa.Integer(), nullable=False),
        sa.Column("threat_level", sa.String(length=20), nullable=False),
        sa.Column("threat_score", sa.Integer(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("altitude_m", sa.Float(), nullable=False),
        sa.Column("speed_mps", sa.Float(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.String(length=120), nullable=False),
        sa.Column("target_id", sa.String(length=120), nullable=False),
        sa.Column("tick", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "anomalies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("target_id", sa.String(length=120), nullable=False),
        sa.Column("tick", sa.Integer(), nullable=False),
        sa.Column("anomaly_score", sa.Float(), nullable=False),
        sa.Column("anomaly_label", sa.String(length=40), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "operational_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tick", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("operational_logs")
    op.drop_table("anomalies")
    op.drop_table("alerts")
    op.drop_table("tracks")
    op.drop_table("sensor_events")
