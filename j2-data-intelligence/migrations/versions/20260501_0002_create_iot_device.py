"""create iot device table

Revision ID: 20260501_0002
Revises: 20260501_0001
Create Date: 2026-05-01 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0002"
down_revision = "20260501_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "Division",
        sa.Column("division_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("district", sa.String(length=100), nullable=True),
        sa.Column("latitude", sa.Numeric(), nullable=True),
        sa.Column("longitude", sa.Numeric(), nullable=True),
    )

    op.create_table(
        "IoT_Device",
        sa.Column("device_id", sa.String(length=50), primary_key=True, nullable=False),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=True),
        sa.Column("installation_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("IoT_Device")
    op.drop_table("Division")