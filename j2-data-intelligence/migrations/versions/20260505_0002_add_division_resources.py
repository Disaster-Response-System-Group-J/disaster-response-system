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
        sa.Column("resource_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=True),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(50), nullable=False, server_default="available"),
        sa.Column("last_updated", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("division_id", "resource_type", name="uq_division_resources_type"),
    )


def downgrade() -> None:
    op.drop_table("DivisionResources")
