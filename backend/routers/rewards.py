from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db, Reward, RewardRedemption, DailyLog, BonusPoint, Task, User
from core.auth import get_current_user, require_parent
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta

router = APIRouter()

class RewardCreate(BaseModel):
    name: str
    description: str = ""
    cost_pts: int

class RewardOut(BaseModel):
    id: int
    name: str
    description: str
    cost_pts: int
    active: bool
    class Config:
        from_attributes = True

class RedemptionOut(BaseModel):
    id: int
    reward_id: int
    user_id: int
    pts_spent: int
    approved: bool
    reward_name: Optional[str] = None
    class Config:
        from_attributes = True

@router.get("/", response_model=List[RewardOut])
def list_rewards(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Reward).filter(Reward.active == True).all()

@router.post("/", response_model=RewardOut)
def create_reward(payload: RewardCreate, parent: User = Depends(require_parent), db: Session = Depends(get_db)):
    r = Reward(**payload.model_dump(), created_by=parent.id)
    db.add(r); db.commit(); db.refresh(r)
    return r

@router.post("/redeem/{reward_id}")
def redeem_reward(reward_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reward = db.query(Reward).filter(Reward.id == reward_id, Reward.active == True).first()
    if not reward:
        raise HTTPException(404, "Reward not found")
    # Check sufficient points
    today       = date.today()
    week_start  = today - timedelta(days=today.weekday())
    week_dates  = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]
    logs  = db.query(DailyLog).filter(DailyLog.user_id == current_user.id, DailyLog.done == True, DailyLog.date.in_(week_dates)).all()
    base  = sum(l.task.points for l in logs if l.task)
    bonus = sum(b.pts for b in db.query(BonusPoint).filter(BonusPoint.user_id == current_user.id).all())
    spent = sum(r.pts_spent for r in db.query(RewardRedemption).filter(RewardRedemption.user_id == current_user.id, RewardRedemption.approved == True).all())
    available = base + bonus - spent
    if available < reward.cost_pts:
        raise HTTPException(400, f"Not enough points ({available} available, {reward.cost_pts} needed)")
    redemption = RewardRedemption(reward_id=reward.id, user_id=current_user.id, pts_spent=reward.cost_pts)
    db.add(redemption); db.commit(); db.refresh(redemption)
    return {"ok": True, "redemption_id": redemption.id, "message": "Redemption requested — waiting for parent approval"}

@router.post("/approve/{redemption_id}")
def approve_redemption(redemption_id: int, parent: User = Depends(require_parent), db: Session = Depends(get_db)):
    r = db.query(RewardRedemption).filter(RewardRedemption.id == redemption_id).first()
    if not r:
        raise HTTPException(404)
    r.approved = True
    db.commit()
    return {"ok": True}

@router.get("/redemptions")
def list_redemptions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(RewardRedemption)
    if current_user.role == "kid":
        q = q.filter(RewardRedemption.user_id == current_user.id)
    items = q.order_by(RewardRedemption.redeemed_at.desc()).all()
    result = []
    for item in items:
        r = db.query(Reward).filter(Reward.id == item.reward_id).first()
        result.append({
            "id": item.id, "reward_id": item.reward_id, "user_id": item.user_id,
            "pts_spent": item.pts_spent, "approved": item.approved,
            "reward_name": r.name if r else None,
            "redeemed_at": item.redeemed_at,
        })
    return result
