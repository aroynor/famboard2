from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from core.database import get_db, User
from core.auth import hash_password, verify_password, create_access_token, get_current_user
from pydantic import BaseModel

router = APIRouter()

class UserCreate(BaseModel):
    username: str
    name: str
    password: str
    role: str = "kid"

class UserOut(BaseModel):
    id: int
    username: str
    name: str
    role: str
    class Config:
        from_attributes = True

@router.post("/token")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "name": user.name}

@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=payload.username,
        name=payload.name,
        password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user); db.commit(); db.refresh(user)
    return user

@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
