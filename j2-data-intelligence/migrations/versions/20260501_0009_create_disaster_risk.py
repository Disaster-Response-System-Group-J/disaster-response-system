"""create disaster risk table

Revision ID: 20260501_0009
Revises: 20260501_0008
Create Date: 2026-05-01 00:00:08.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0009"
down_revision = "20260501_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "DisasterRisk",
        sa.Column("risk_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("disaster_type", sa.String(length=50), nullable=True),
        sa.Column("risk_level", sa.String(length=20), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.UniqueConstraint("division_id", "date", "disaster_type", name="uq_disaster_risk_division_date_type"),
    )


def downgrade() -> None:
    op.drop_table("DisasterRisk")