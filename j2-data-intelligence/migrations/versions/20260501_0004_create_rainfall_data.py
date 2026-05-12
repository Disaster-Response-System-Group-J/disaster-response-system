"""create rainfall data table

Revision ID: 20260501_0004
Revises: 20260501_0003
Create Date: 2026-05-01 00:00:03.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0004"
down_revision = "20260501_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "RainfallData",
        sa.Column("rainfall_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("rain_sum", sa.Float(), nullable=True),
        sa.UniqueConstraint("division_id", "date", name="uq_rainfall_division_date"),
    )


def downgrade() -> None:
    op.drop_table("RainfallData")