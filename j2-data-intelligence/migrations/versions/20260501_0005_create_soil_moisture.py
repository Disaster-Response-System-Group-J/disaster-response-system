"""create soil moisture table

Revision ID: 20260501_0005
Revises: 20260501_0004
Create Date: 2026-05-01 00:00:04.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0005"
down_revision = "20260501_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "SoilMoisture",
        sa.Column("soil_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("moisture_7_28cm", sa.Float(), nullable=True),
        sa.Column("moisture_28_100cm", sa.Float(), nullable=True),
        sa.Column("moisture_100_255cm", sa.Float(), nullable=True),
        sa.UniqueConstraint("division_id", "date", name="uq_soil_moisture_division_date"),
    )


def downgrade() -> None:
    op.drop_table("SoilMoisture")