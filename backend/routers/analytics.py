from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db, DailyLog, Task, BonusPoint, User
from core.auth import get_current_user
from datetime import date, timedelta
from collections import defaultdict

router = APIRouter()

@router.get("/weekly/{user_id}")
def weekly_analytics(user_id: int, weeks: int = 4, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "kid" and current_user.id != user_id:
        raise HTTPException(403)
    today      = date.today()
    week_start = today - timedelta(days=today.weekday())
    result = []
    for w in range(weeks - 1, -1, -1):
        ws    = week_start - timedelta(weeks=w)
        dates = [(ws + timedelta(days=i)).isoformat() for i in range(7)]
        logs  = db.query(DailyLog).filter(
            DailyLog.user_id == user_id,
            DailyLog.date.in_(dates),
        ).all()
        done  = [l for l in logs if l.done]
        pts   = sum(l.task.points for l in done if l.task)
        result.append({
            "week_start":  ws.isoformat(),
            "label":       ws.strftime("%-d %b"),
            "tasks_done":  len(done),
            "tasks_total": len(logs),
            "points":      pts,
            "pct":         round(len(done) / len(logs) * 100) if logs else 0,
        })
    return result

@router.get("/category/{user_id}")
def category_breakdown(user_id: int, days: int = 7, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "kid" and current_user.id != user_id:
        raise HTTPException(403)
    today = date.today()
    dates = [(today - timedelta(days=i)).isoformat() for i in range(days)]
    logs  = db.query(DailyLog).filter(
        DailyLog.user_id == user_id,
        DailyLog.date.in_(dates),
    ).join(Task).all()
    cats = defaultdict(lambda: {"done": 0, "total": 0, "points": 0})
    for l in logs:
        c = l.task.category if l.task else "other"
        cats[c]["total"] += 1
        if l.done:
            cats[c]["done"] += 1
            cats[c]["points"] += l.task.points if l.task else 0
    return [{"category": k, **v, "pct": round(v["done"] / v["total"] * 100) if v["total"] else 0}
            for k, v in cats.items()]

@router.get("/streak/{user_id}")
def streak(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "kid" and current_user.id != user_id:
        raise HTTPException(403)
    today   = date.today()
    current = 0
    d       = today
    while True:
        logs = db.query(DailyLog).filter(DailyLog.user_id == user_id, DailyLog.date == d.isoformat()).all()
        if not logs:
            break
        if all(l.done for l in logs):
            current += 1
            d -= timedelta(days=1)
        else:
            break
    return {"current_streak": current}
