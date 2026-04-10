from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db, User, Task, Reward, CategoryEnum, RecurrenceEnum
from core.auth import require_parent, hash_password
from typing import List
from pydantic import BaseModel

router = APIRouter()

class UserOut(BaseModel):
    id: int
    username: str
    name: str
    role: str
    class Config:
        from_attributes = True

@router.get("/users", response_model=List[UserOut])
def list_users(parent=Depends(require_parent), db: Session = Depends(get_db)):
    return db.query(User).all()

@router.post("/seed")
def seed_data(parent=Depends(require_parent), db: Session = Depends(get_db)):
    """Seed sample tasks and rewards. Safe to run multiple times."""
    # Find first kid
    kid = db.query(User).filter(User.role == "kid").first()
    if not kid:
        return {"ok": False, "message": "No kid user found. Create one first."}

    existing = db.query(Task).filter(Task.assigned_to == kid.id).count()
    if existing == 0:
        tasks = [
            Task(name="Morning routine",        category=CategoryEnum.chore,  time_slot="07:30", duration_min=20, points=5,  recurrence=RecurrenceEnum.daily,    assigned_to=kid.id, created_by=parent.id),
            Task(name="Breakfast + dishes",     category=CategoryEnum.chore,  time_slot="08:00", duration_min=20, points=5,  recurrence=RecurrenceEnum.daily,    assigned_to=kid.id, created_by=parent.id),
            Task(name="Math — Khan Academy",    category=CategoryEnum.study,  time_slot="09:00", duration_min=60, points=15, recurrence=RecurrenceEnum.weekdays,  assigned_to=kid.id, created_by=parent.id),
            Task(name="English reading",        category=CategoryEnum.study,  time_slot="10:30", duration_min=30, points=10, recurrence=RecurrenceEnum.weekdays,  assigned_to=kid.id, created_by=parent.id),
            Task(name="Lunch + tidy kitchen",   category=CategoryEnum.chore,  time_slot="12:30", duration_min=20, points=5,  recurrence=RecurrenceEnum.daily,    assigned_to=kid.id, created_by=parent.id),
            Task(name="Guitar practice",        category=CategoryEnum.music,  time_slot="14:00", duration_min=45, points=20, recurrence=RecurrenceEnum.daily,    assigned_to=kid.id, created_by=parent.id),
            Task(name="Football training",      category=CategoryEnum.sport,  time_slot="16:00", duration_min=90, points=15, recurrence=RecurrenceEnum.weekdays,  assigned_to=kid.id, created_by=parent.id),
            Task(name="Homework",               category=CategoryEnum.study,  time_slot="18:00", duration_min=60, points=15, recurrence=RecurrenceEnum.weekdays,  assigned_to=kid.id, created_by=parent.id),
            Task(name="Swimming session",       category=CategoryEnum.sport,  time_slot="17:00", duration_min=60, points=20, recurrence=RecurrenceEnum.weekend,  assigned_to=kid.id, created_by=parent.id),
            Task(name="Room tidy + bed prep",   category=CategoryEnum.chore,  time_slot="20:30", duration_min=15, points=5,  recurrence=RecurrenceEnum.daily,    assigned_to=kid.id, created_by=parent.id),
        ]
        db.add_all(tasks)

    if db.query(Reward).count() == 0:
        rewards = [
            Reward(name="Extra screen time (1hr)",  description="One hour extra gaming or YouTube", cost_pts=50,  created_by=parent.id),
            Reward(name="Choose weekend dinner",    description="Pick the Friday/Saturday dinner",  cost_pts=80,  created_by=parent.id),
            Reward(name="Skip one chore",           description="One chore pass for the week",      cost_pts=60,  created_by=parent.id),
            Reward(name="Movie night pick",         description="Choose the family movie",           cost_pts=100, created_by=parent.id),
            Reward(name="Late bedtime (30 min)",    description="Stay up 30 min extra on Friday",   cost_pts=70,  created_by=parent.id),
        ]
        db.add_all(rewards)

    db.commit()
    return {"ok": True, "message": f"Seeded tasks and rewards for {kid.name}"}
