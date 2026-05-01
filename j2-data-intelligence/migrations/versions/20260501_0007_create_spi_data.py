"""create spi data table

Revision ID: 20260501_0007
Revises: 20260501_0006
Create Date: 2026-05-01 00:00:06.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0007"
down_revision = "20260501_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "SPI_Data",
        sa.Column("spi_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("spi_value", sa.Float(), nullable=True),
        sa.Column("timescale", sa.Integer(), nullable=False),
        sa.UniqueConstraint("division_id", "date", "timescale", name="uq_spi_division_date_timescale"),
    )


def downgrade() -> None:
    op.drop_table("SPI_Data")