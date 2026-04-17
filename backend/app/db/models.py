from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str | None] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    plates: Mapped[list[Plate]] = relationship(back_populates="author", lazy="noload")
    votes: Mapped[list[Vote]] = relationship(back_populates="user", lazy="noload")


class State(Base):
    __tablename__ = "states"

    code: Mapped[str] = mapped_column(String(2), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    region: Mapped[str] = mapped_column(Text, nullable=False)


class PlateStatus(enum.StrEnum):
    approved = "approved"
    rejected = "rejected"


class RejectionReason(enum.StrEnum):
    not_a_plate = "not_a_plate"
    explicit = "explicit"
    offensive_text = "offensive_text"
    duplicate = "duplicate"
    spam_rate_limit = "spam_rate_limit"
    low_quality = "low_quality"
    other = "other"


class Plate(Base):
    __tablename__ = "plates"
    __table_args__ = (
        Index("plates_feed_idx", "created_at", postgresql_where="status = 'approved'"),
        Index(
            "plates_state_feed_idx",
            "state_code",
            "created_at",
            postgresql_where="status = 'approved'",
        ),
        Index(
            "plates_score_idx",
            "score",
            "created_at",
            postgresql_where="status = 'approved'",
        ),
        Index("plates_phash_idx", "image_phash"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    state_code: Mapped[str] = mapped_column(
        String(2), ForeignKey("states.code"), nullable=False
    )
    plate_text: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text)
    image_path: Mapped[str] = mapped_column(Text, nullable=False)
    image_width: Mapped[int | None] = mapped_column(Integer)
    image_height: Mapped[int | None] = mapped_column(Integer)
    image_phash: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[PlateStatus] = mapped_column(
        Enum(PlateStatus, name="plate_status", create_constraint=False), nullable=False
    )
    rejection_reason: Mapped[RejectionReason | None] = mapped_column(
        Enum(RejectionReason, name="rejection_reason", create_constraint=False)
    )
    rejection_detail: Mapped[str | None] = mapped_column(Text)
    upvotes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    downvotes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    comment_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    author: Mapped[User | None] = relationship(back_populates="plates", lazy="joined")
    state: Mapped[State] = relationship(lazy="joined")
    vote_records: Mapped[list[Vote]] = relationship(back_populates="plate", lazy="noload")
    comments: Mapped[list[Comment]] = relationship(back_populates="plate", lazy="noload")


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (
        CheckConstraint("value IN (-1, 1)", name="vote_value_check"),
        Index("votes_plate_idx", "plate_id"),
        Index("votes_user_idx", "user_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    plate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plates.id", ondelete="CASCADE"), primary_key=True
    )
    value: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="votes", lazy="noload")
    plate: Mapped[Plate] = relationship(back_populates="vote_records", lazy="noload")


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (Index("comments_plate_idx", "plate_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    plate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plates.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    plate: Mapped[Plate] = relationship(back_populates="comments", lazy="noload")
    author: Mapped[User] = relationship(lazy="joined")


class UploadToken(Base):
    __tablename__ = "upload_tokens"
    __table_args__ = (Index("upload_tokens_user_idx", "user_id", "created_at"),)

    token: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    object_path: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RateLimitEvent(Base):
    __tablename__ = "rate_limit_events"
    __table_args__ = (
        Index("rate_limit_user_bucket_time", "user_id", "bucket", "created_at"),
        Index("rate_limit_ip_bucket_time", "ip", "bucket", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    ip: Mapped[str | None] = mapped_column(INET)
    bucket: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
