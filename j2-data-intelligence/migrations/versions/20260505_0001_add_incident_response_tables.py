"""add incident reporting and response tables

Revision ID: 20260505_0001
Revises: 20260501_0009
Create Date: 2026-05-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260505_0001"
down_revision = "20260501_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ActiveIncident",
        sa.Column("incident_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("affected_population", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'ACTIVE'"), nullable=False),
        sa.Column("latitude", sa.Numeric(), nullable=True),
        sa.Column("longitude", sa.Numeric(), nullable=True),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "Report",
        sa.Column("report_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("source_channel", sa.String(), nullable=False),
        sa.Column("reporter_name", sa.String(), nullable=True),
        sa.Column("contact_info", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("media_url", sa.String(), nullable=True),
        sa.Column("latitude", sa.Numeric(), nullable=True),
        sa.Column("longitude", sa.Numeric(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'PENDING_REVIEW'"), nullable=False),
        sa.Column("incident_id", sa.Integer(), sa.ForeignKey("ActiveIncident.incident_id"), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
    )

    op.create_table(
        "DeployableAsset",
        sa.Column("asset_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'AVAILABLE'"), nullable=False),
        sa.Column("base_location", sa.String(), nullable=True),
        sa.Column("current_latitude", sa.Numeric(), nullable=True),
        sa.Column("current_longitude", sa.Numeric(), nullable=True),
    )

    op.create_table(
        "DispatchRecord",
        sa.Column("dispatch_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("incident_id", sa.Integer(), sa.ForeignKey("ActiveIncident.incident_id"), nullable=True),
        sa.Column("asset_id", sa.Integer(), sa.ForeignKey("DeployableAsset.asset_id"), nullable=True),
        sa.Column("deployment_status", sa.String(), server_default=sa.text("'EN_ROUTE'"), nullable=False),
        sa.Column(
            "dispatched_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "PublicAlert",
        sa.Column("alert_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("incident_id", sa.Integer(), sa.ForeignKey("ActiveIncident.incident_id"), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("severity_level", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'ACTIVE'"), nullable=False),
        sa.Column(
            "issued_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
    )

    op.create_table(
        "Shelter",
        sa.Column("shelter_id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("division_id", sa.Integer(), sa.ForeignKey("Division.division_id"), nullable=True),
        sa.Column("latitude", sa.Numeric(), nullable=True),
        sa.Column("longitude", sa.Numeric(), nullable=True),
        sa.Column("max_capacity", sa.Integer(), nullable=False),
        sa.Column("current_occupancy", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'CLOSED'"), nullable=False),
        sa.Column("contact_person", sa.String(), nullable=True),
        sa.Column("contact_phone", sa.String(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("Shelter")
    op.drop_table("PublicAlert")
    op.drop_table("DispatchRecord")
    op.drop_table("DeployableAsset")
    op.drop_table("Report")
    op.drop_table("ActiveIncident")
