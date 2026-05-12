"""create flood severity table

Revision ID: 20260501_0008
Revises: 20260501_0007
Create Date: 2026-05-01 00:00:07.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0008"
down_revision = "20260501_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "FloodSeverity",
        sa.Column("severity_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("device_id", sa.String(length=50), sa.ForeignKey("IoT_Device.device_id"), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
        sa.Column("current_level", sa.Float(), nullable=True),
        sa.Column("base_level", sa.Float(), nullable=True),
        sa.Column("difference", sa.Float(), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("FloodSeverity")