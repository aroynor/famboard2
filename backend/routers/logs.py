from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db, DailyLog, Task, User
from core.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

router = APIRouter()

class LogOut(BaseModel):
    id: int
    task_id: int
    user_id: int
    date: str
    done: bool
    done_at: Optional[datetime]
    comment: str
    bonus_pts: int
    task_name: Optional[str] = None
    task_category: Optional[str] = None
    task_time_slot: Optional[str] = None
    task_points: Optional[int] = None
    class Config:
        from_attributes = True

class LogUpdate(BaseModel):
    done: Optional[bool] = None
    comment: Optional[str] = None

def _enrich(log: DailyLog) -> dict:
    d = {
        "id": log.id,
        "task_id": log.task_id,
        "user_id": log.user_id,
        "date": log.date,
        "done": log.done,
        "done_at": log.done_at,
        "comment": log.comment or "",
        "bonus_pts": log.bonus_pts or 0,
        "task_name": log.task.name if log.task else None,
        "task_category": log.task.category if log.task else None,
        "task_time_slot": log.task.time_slot if log.task else None,
        "task_points": log.task.points if log.task else None,
    }
    return d

def _ensure_logs_for_date(db: Session, user_id: int, target_date: str):
    """Auto-create log rows for all active tasks on a given date if missing."""
    from core.database import RecurrenceEnum
    tasks = db.query(Task).filter(Task.active == True, Task.assigned_to == user_id).all()
    d = date.fromisoformat(target_date)
    wday = d.weekday()
    for t in tasks:
        rec = t.recurrence
        if rec == RecurrenceEnum.weekdays and wday >= 5:
            continue
        if rec == RecurrenceEnum.weekend and wday < 5:
            continue
        existing = db.query(DailyLog).filter(
            DailyLog.task_id == t.id,
            DailyLog.user_id == user_id,
            DailyLog.date == target_date,
        ).first()
        if not existing:
            db.add(DailyLog(task_id=t.id, user_id=user_id, date=target_date))
    db.commit()

@router.get("/{target_date}")
def get_logs(target_date: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    _ensure_logs_for_date(db, user_id, target_date)
    logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user_id, DailyLog.date == target_date)
        .join(Task)
        .order_by(Task.time_slot)
        .all()
    )
    return [_enrich(l) for l in logs]

@router.patch("/{log_id}")
def update_log(log_id: int, payload: LogUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(404, "Log not found")
    if current_user.role == "kid" and log.user_id != current_user.id:
        raise HTTPException(403, "Not your log")
    if payload.done is not None:
        log.done = payload.done
        log.done_at = datetime.utcnow() if payload.done else None
    if payload.comment is not None:
        log.comment = payload.comment
    db.commit(); db.refresh(log)
    return _enrich(log)

@router.get("/parent/{user_id}/{target_date}")
def get_logs_parent(user_id: int, target_date: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent" and current_user.id != user_id:
        raise HTTPException(403, "Access denied")
    _ensure_logs_for_date(db, user_id, target_date)
    logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user_id, DailyLog.date == target_date)
        .join(Task)
        .order_by(Task.time_slot)
        .all()
    )
    return [_enrich(l) for l in logs]
