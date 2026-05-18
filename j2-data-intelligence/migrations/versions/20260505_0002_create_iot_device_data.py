"""create iot device data table

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
        "IoT_Device_Data",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("device_id", sa.String(length=50), sa.ForeignKey("IoT_Device.device_id"), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("IoT_Device_Data")
