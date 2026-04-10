from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db, Task, CategoryEnum, RecurrenceEnum
from core.auth import get_current_user, require_parent
from core.database import User
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter()

class TaskCreate(BaseModel):
    name: str
    category: CategoryEnum
    time_slot: str
    duration_min: int = 30
    points: int = 10
    recurrence: RecurrenceEnum = RecurrenceEnum.daily
    assigned_to: int

class TaskOut(BaseModel):
    id: int
    name: str
    category: str
    time_slot: str
    duration_min: int
    points: int
    recurrence: str
    active: bool
    assigned_to: int
    class Config:
        from_attributes = True

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[CategoryEnum] = None
    time_slot: Optional[str] = None
    duration_min: Optional[int] = None
    points: Optional[int] = None
    recurrence: Optional[RecurrenceEnum] = None
    active: Optional[bool] = None

@router.get("/", response_model=List[TaskOut])
def list_tasks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Task).filter(Task.active == True)
    if current_user.role == "kid":
        q = q.filter(Task.assigned_to == current_user.id)
    return q.order_by(Task.time_slot).all()

@router.post("/", response_model=TaskOut)
def create_task(payload: TaskCreate, parent: User = Depends(require_parent), db: Session = Depends(get_db)):
    task = Task(**payload.model_dump(), created_by=parent.id)
    db.add(task); db.commit(); db.refresh(task)
    return task

@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, parent: User = Depends(require_parent), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(task, k, v)
    db.commit(); db.refresh(task)
    return task

@router.delete("/{task_id}")
def delete_task(task_id: int, parent: User = Depends(require_parent), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.active = False
    db.commit()
    return {"ok": True}
