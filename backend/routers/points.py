from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db, DailyLog, BonusPoint, Task, User
from core.auth import get_current_user, require_parent
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

router = APIRouter()

class BonusCreate(BaseModel):
    user_id: int
    pts: int
    reason: str = ""

class BonusOut(BaseModel):
    id: int
    user_id: int
    pts: int
    reason: str
    class Config:
        from_attributes = True

def _calc_points(db: Session, user_id: int, dates: list[str]) -> int:
    logs = db.query(DailyLog).filter(
        DailyLog.user_id == user_id,
        DailyLog.done == True,
        DailyLog.date.in_(dates),
    ).all()
    base = sum(l.task.points for l in logs if l.task)
    bonus = db.query(BonusPoint).filter(BonusPoint.user_id == user_id).all()
    return base + sum(b.pts for b in bonus)

@router.get("/summary/{user_id}")
def points_summary(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "kid" and current_user.id != user_id:
        raise HTTPException(403)
    today       = date.today()
    week_start  = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    today_dates  = [today.isoformat()]
    week_dates   = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]
    month_dates  = [(month_start + timedelta(days=i)).isoformat()
                    for i in range((today - month_start).days + 1)]

    return {
        "today": _calc_points(db, user_id, today_dates),
        "week":  _calc_points(db, user_id, week_dates),
        "month": _calc_points(db, user_id, month_dates),
    }

@router.post("/bonus", response_model=BonusOut)
def add_bonus(payload: BonusCreate, parent: User = Depends(require_parent), db: Session = Depends(get_db)):
    b = BonusPoint(user_id=payload.user_id, pts=payload.pts, reason=payload.reason, granted_by=parent.id)
    db.add(b); db.commit(); db.refresh(b)
    return b
