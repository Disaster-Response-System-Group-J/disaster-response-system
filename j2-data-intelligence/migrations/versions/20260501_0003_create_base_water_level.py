"""create base water level table

Revision ID: 20260501_0003
Revises: 20260501_0002
Create Date: 2026-05-01 00:00:02.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0003"
down_revision = "20260501_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "BaseWaterLevel",
        sa.Column(
            "device_id",
            sa.String(length=50),
            sa.ForeignKey("IoT_Device.device_id"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("base_level", sa.Float(), nullable=False),
        sa.Column("set_date", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("BaseWaterLevel")