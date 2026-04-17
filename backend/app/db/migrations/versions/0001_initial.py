"""Initial schema with all tables, indexes, triggers, and state seeds.

Revision ID: 0001
Revises: None
Create Date: 2026-04-16
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATES = [
    ("AL", "Alabama", "Southeast"),
    ("AK", "Alaska", "West"),
    ("AZ", "Arizona", "Southwest"),
    ("AR", "Arkansas", "Southeast"),
    ("CA", "California", "West"),
    ("CO", "Colorado", "West"),
    ("CT", "Connecticut", "Northeast"),
    ("DE", "Delaware", "Northeast"),
    ("FL", "Florida", "Southeast"),
    ("GA", "Georgia", "Southeast"),
    ("HI", "Hawaii", "West"),
    ("ID", "Idaho", "West"),
    ("IL", "Illinois", "Midwest"),
    ("IN", "Indiana", "Midwest"),
    ("IA", "Iowa", "Midwest"),
    ("KS", "Kansas", "Midwest"),
    ("KY", "Kentucky", "Southeast"),
    ("LA", "Louisiana", "Southeast"),
    ("ME", "Maine", "Northeast"),
    ("MD", "Maryland", "Northeast"),
    ("MA", "Massachusetts", "Northeast"),
    ("MI", "Michigan", "Midwest"),
    ("MN", "Minnesota", "Midwest"),
    ("MS", "Mississippi", "Southeast"),
    ("MO", "Missouri", "Midwest"),
    ("MT", "Montana", "West"),
    ("NE", "Nebraska", "Midwest"),
    ("NV", "Nevada", "West"),
    ("NH", "New Hampshire", "Northeast"),
    ("NJ", "New Jersey", "Northeast"),
    ("NM", "New Mexico", "Southwest"),
    ("NY", "New York", "Northeast"),
    ("NC", "North Carolina", "Southeast"),
    ("ND", "North Dakota", "Midwest"),
    ("OH", "Ohio", "Midwest"),
    ("OK", "Oklahoma", "Southwest"),
    ("OR", "Oregon", "West"),
    ("PA", "Pennsylvania", "Northeast"),
    ("RI", "Rhode Island", "Northeast"),
    ("SC", "South Carolina", "Southeast"),
    ("SD", "South Dakota", "Midwest"),
    ("TN", "Tennessee", "Southeast"),
    ("TX", "Texas", "Southwest"),
    ("UT", "Utah", "West"),
    ("VT", "Vermont", "Northeast"),
    ("VA", "Virginia", "Southeast"),
    ("WA", "Washington", "West"),
    ("WV", "West Virginia", "Southeast"),
    ("WI", "Wisconsin", "Midwest"),
    ("WY", "Wyoming", "West"),
    ("DC", "District of Columbia", "Northeast"),
]


def upgrade() -> None:
    # Enums
    plate_status = postgresql.ENUM("approved", "rejected", name="plate_status", create_type=False)
    rejection_reason = postgresql.ENUM(
        "not_a_plate", "explicit", "offensive_text", "duplicate",
        "spam_rate_limit", "low_quality", "other",
        name="rejection_reason", create_type=False,
    )
    op.execute("CREATE TYPE plate_status AS ENUM ('approved', 'rejected')")
    op.execute(
        "CREATE TYPE rejection_reason AS ENUM "
        "('not_a_plate', 'explicit', 'offensive_text', 'duplicate', "
        "'spam_rate_limit', 'low_quality', 'other')"
    )

    # Users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.Text()),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # States
    op.create_table(
        "states",
        sa.Column("code", sa.String(2), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("region", sa.Text(), nullable=False),
    )

    # Seed states
    states_table = sa.table(
        "states",
        sa.column("code", sa.String),
        sa.column("name", sa.Text),
        sa.column("region", sa.Text),
    )
    op.bulk_insert(
        states_table,
        [{"code": code, "name": name, "region": region} for code, name, region in STATES],
    )

    # Plates
    op.create_table(
        "plates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("state_code", sa.String(2), sa.ForeignKey("states.code"), nullable=False),
        sa.Column("plate_text", sa.Text(), nullable=False),
        sa.Column("caption", sa.Text()),
        sa.Column("image_path", sa.Text(), nullable=False),
        sa.Column("image_width", sa.Integer()),
        sa.Column("image_height", sa.Integer()),
        sa.Column("image_phash", sa.BigInteger()),
        sa.Column("status", plate_status, nullable=False),
        sa.Column("rejection_reason", rejection_reason),
        sa.Column("rejection_detail", sa.Text()),
        sa.Column("upvotes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("downvotes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comment_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
    )

    op.create_index("plates_feed_idx", "plates", ["created_at"], postgresql_where=sa.text("status = 'approved'"))
    op.create_index("plates_state_feed_idx", "plates", ["state_code", "created_at"], postgresql_where=sa.text("status = 'approved'"))
    op.create_index("plates_score_idx", "plates", ["score", "created_at"], postgresql_where=sa.text("status = 'approved'"))
    op.create_index("plates_phash_idx", "plates", ["image_phash"])

    # Votes
    op.create_table(
        "votes",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("plate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plates.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("value", sa.SmallInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("value IN (-1, 1)", name="vote_value_check"),
    )
    op.create_index("votes_plate_idx", "votes", ["plate_id"])
    op.create_index("votes_user_idx", "votes", ["user_id", "created_at"])

    # Comments
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("plate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("comments_plate_idx", "comments", ["plate_id", "created_at"])

    # Upload tokens
    op.create_table(
        "upload_tokens",
        sa.Column("token", sa.Text(), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("object_path", sa.Text(), nullable=False),
        sa.Column("content_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("upload_tokens_user_idx", "upload_tokens", ["user_id", "created_at"])

    # Rate limit events
    op.create_table(
        "rate_limit_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("ip", postgresql.INET()),
        sa.Column("bucket", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("rate_limit_user_bucket_time", "rate_limit_events", ["user_id", "bucket", "created_at"])
    op.create_index("rate_limit_ip_bucket_time", "rate_limit_events", ["ip", "bucket", "created_at"])

    # Triggers for denormalized vote counters
    op.execute("""
        CREATE OR REPLACE FUNCTION update_plate_vote_counts() RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE plates SET
                    upvotes = upvotes + CASE WHEN NEW.value = 1 THEN 1 ELSE 0 END,
                    downvotes = downvotes + CASE WHEN NEW.value = -1 THEN 1 ELSE 0 END,
                    score = upvotes - downvotes + CASE WHEN NEW.value = 1 THEN 1 ELSE -1 END
                WHERE id = NEW.plate_id;
                RETURN NEW;
            ELSIF TG_OP = 'UPDATE' THEN
                UPDATE plates SET
                    upvotes = upvotes
                        - CASE WHEN OLD.value = 1 THEN 1 ELSE 0 END
                        + CASE WHEN NEW.value = 1 THEN 1 ELSE 0 END,
                    downvotes = downvotes
                        - CASE WHEN OLD.value = -1 THEN 1 ELSE 0 END
                        + CASE WHEN NEW.value = -1 THEN 1 ELSE 0 END,
                    score = upvotes - downvotes
                        - CASE WHEN OLD.value = 1 THEN 1 ELSE 0 END
                        + CASE WHEN NEW.value = 1 THEN 1 ELSE 0 END
                        + CASE WHEN OLD.value = -1 THEN 1 ELSE 0 END
                        - CASE WHEN NEW.value = -1 THEN 1 ELSE 0 END
                WHERE id = NEW.plate_id;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE plates SET
                    upvotes = GREATEST(0, upvotes - CASE WHEN OLD.value = 1 THEN 1 ELSE 0 END),
                    downvotes = GREATEST(0, downvotes - CASE WHEN OLD.value = -1 THEN 1 ELSE 0 END),
                    score = GREATEST(0, upvotes - CASE WHEN OLD.value = 1 THEN 1 ELSE 0 END)
                         - GREATEST(0, downvotes - CASE WHEN OLD.value = -1 THEN 1 ELSE 0 END)
                WHERE id = OLD.plate_id;
                RETURN OLD;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_vote_counts
        AFTER INSERT OR UPDATE OR DELETE ON votes
        FOR EACH ROW EXECUTE FUNCTION update_plate_vote_counts();
    """)

    # Trigger for comment count
    op.execute("""
        CREATE OR REPLACE FUNCTION update_plate_comment_count() RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE plates SET comment_count = comment_count + 1 WHERE id = NEW.plate_id;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE plates SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.plate_id;
                RETURN OLD;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_comment_count
        AFTER INSERT OR DELETE ON comments
        FOR EACH ROW EXECUTE FUNCTION update_plate_comment_count();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_comment_count ON comments")
    op.execute("DROP FUNCTION IF EXISTS update_plate_comment_count")
    op.execute("DROP TRIGGER IF EXISTS trg_vote_counts ON votes")
    op.execute("DROP FUNCTION IF EXISTS update_plate_vote_counts")
    op.drop_table("rate_limit_events")
    op.drop_table("upload_tokens")
    op.drop_table("comments")
    op.drop_table("votes")
    op.drop_table("plates")
    op.drop_table("states")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS rejection_reason")
    op.execute("DROP TYPE IF EXISTS plate_status")
