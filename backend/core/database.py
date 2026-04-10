from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/famboard.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class CategoryEnum(str, enum.Enum):
    chore  = "chore"
    study  = "study"
    sport  = "sport"
    music  = "music"

class RecurrenceEnum(str, enum.Enum):
    daily   = "daily"
    weekdays = "weekdays"
    weekend = "weekend"
    weekly  = "weekly"
    once    = "once"

class User(Base):
    __tablename__ = "users"
    id         = Column(Integer, primary_key=True)
    username   = Column(String(50), unique=True, nullable=False)
    name       = Column(String(100))
    password   = Column(String(200), nullable=False)
    role       = Column(String(20), default="kid")   # "parent" | "kid"
    created_at = Column(DateTime, default=datetime.utcnow)

class Task(Base):
    __tablename__ = "tasks"
    id          = Column(Integer, primary_key=True)
    name        = Column(String(200), nullable=False)
    category    = Column(Enum(CategoryEnum), nullable=False)
    time_slot   = Column(String(10))          # "08:00"
    duration_min= Column(Integer, default=30)
    points      = Column(Integer, default=10)
    recurrence  = Column(Enum(RecurrenceEnum), default=RecurrenceEnum.daily)
    active      = Column(Boolean, default=True)
    assigned_to = Column(Integer, ForeignKey("users.id"))
    created_by  = Column(Integer, ForeignKey("users.id"))
    created_at  = Column(DateTime, default=datetime.utcnow)
    logs        = relationship("DailyLog", back_populates="task")

class DailyLog(Base):
    __tablename__ = "daily_logs"
    id          = Column(Integer, primary_key=True)
    task_id     = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    date        = Column(String(10), nullable=False)  # "2025-04-11"
    done        = Column(Boolean, default=False)
    done_at     = Column(DateTime, nullable=True)
    comment     = Column(Text, default="")
    bonus_pts   = Column(Integer, default=0)
    task        = relationship("Task", back_populates="logs")

class WeeklySummary(Base):
    __tablename__ = "weekly_summaries"
    id            = Column(Integer, primary_key=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_start    = Column(String(10), nullable=False)  # ISO Monday date
    total_pts     = Column(Integer, default=0)
    tasks_done    = Column(Integer, default=0)
    tasks_total   = Column(Integer, default=0)
    created_at    = Column(DateTime, default=datetime.utcnow)

class Reward(Base):
    __tablename__ = "rewards"
    id          = Column(Integer, primary_key=True)
    name        = Column(String(200), nullable=False)
    description = Column(Text, default="")
    cost_pts    = Column(Integer, nullable=False)
    active      = Column(Boolean, default=True)
    created_by  = Column(Integer, ForeignKey("users.id"))

class RewardRedemption(Base):
    __tablename__ = "reward_redemptions"
    id          = Column(Integer, primary_key=True)
    reward_id   = Column(Integer, ForeignKey("rewards.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    redeemed_at = Column(DateTime, default=datetime.utcnow)
    approved    = Column(Boolean, default=False)
    pts_spent   = Column(Integer, nullable=False)

class BonusPoint(Base):
    __tablename__ = "bonus_points"
    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    pts         = Column(Integer, nullable=False)
    reason      = Column(String(200), default="")
    granted_by  = Column(Integer, ForeignKey("users.id"))
    granted_at  = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
