"""add consideration score table

Revision ID: 20260507_0001
Revises: 20260505_0003
Create Date: 2026-05-07 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260507_0001"
down_revision = "20260505_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ConsiderationScore",
        sa.Column("consideration_score_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=False),
        sa.Column("hazard_type", sa.String(length=50), nullable=False),
        sa.Column("consideration_score", sa.Float(), nullable=False),
        sa.UniqueConstraint("division_id", "hazard_type", name="uq_consideration_score_division_hazard"),
        sa.CheckConstraint("consideration_score >= 0 AND consideration_score <= 1", name="ck_consideration_score_bounds"),
    )


def downgrade() -> None:
    op.drop_table("ConsiderationScore")