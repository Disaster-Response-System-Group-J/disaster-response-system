"""add division resources table

Revision ID: 20260505_0002
Revises: 20260505_0001
Create Date: 2026-05-05 00:00:02.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260505_0002"
down_revision = "20260505_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "DivisionResources",
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), primary_key=True, nullable=False),
        sa.Column("hospital_bed_capacity", sa.Integer(), nullable=True),
        sa.Column("emergency_shelters", sa.Integer(), nullable=True),
        sa.Column("ambulance_count", sa.Integer(), nullable=True),
        sa.Column("food_stock_tons", sa.Float(), nullable=True),
        sa.Column("clean_water_capacity_liters", sa.Float(), nullable=True),
        sa.Column("power_grid_resilience", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("DivisionResources")
