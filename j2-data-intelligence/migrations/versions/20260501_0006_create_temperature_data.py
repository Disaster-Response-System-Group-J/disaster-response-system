"""create temperature data table

Revision ID: 20260501_0006
Revises: 20260501_0005
Create Date: 2026-05-01 00:00:05.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0006"
down_revision = "20260501_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "TemperatureData",
        sa.Column("temp_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.UniqueConstraint("division_id", "date", name="uq_temperature_division_date"),
    )


def downgrade() -> None:
    op.drop_table("TemperatureData")