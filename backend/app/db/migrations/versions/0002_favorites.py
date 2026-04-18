"""Add favorites table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-17
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "favorites",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["plate_id"], ["plates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "plate_id"),
    )
    op.create_index("favorites_user_idx", "favorites", ["user_id", "created_at"])
    op.create_index("favorites_plate_idx", "favorites", ["plate_id"])


def downgrade() -> None:
    op.drop_index("favorites_plate_idx", table_name="favorites")
    op.drop_index("favorites_user_idx", table_name="favorites")
    op.drop_table("favorites")
