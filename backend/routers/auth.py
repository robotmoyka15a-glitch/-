"""
WashControl — авторизация
JWT-токены, логин, получение текущего пользователя
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
import jwt

from backend.database import get_connection, hash_password
from backend.config import SECRET_KEY, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Pydantic схемы ────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    full_name: str
    role: str


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: int


class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    role: str = "operator"


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


# ── JWT утилиты ───────────────────────────────────────────────────────────────

def create_token(user_id: int, username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Токен истёк")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Недействительный токен")


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Dependency — возвращает текущего пользователя из JWT."""
    payload = decode_token(token)
    user_id = int(payload["sub"])
    conn = get_connection()
    user = conn.execute(
        "SELECT * FROM users WHERE id = ? AND is_active = 1", (user_id,)
    ).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return dict(user)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency — только для администраторов."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return current_user


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends()):
    """Логин по username/password, возвращает JWT."""
    conn = get_connection()
    user = conn.execute(
        "SELECT * FROM users WHERE username = ? AND is_active = 1",
        (form.username,)
    ).fetchone()
    conn.close()

    if not user or user["password"] != hash_password(form.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    token = create_token(user["id"], user["username"], user["role"])
    return TokenResponse(
        access_token=token,
        user_id=user["id"],
        username=user["username"],
        full_name=user["full_name"],
        role=user["role"],
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: dict = Depends(get_current_user)):
    """Возвращает данные текущего пользователя."""
    return UserOut(**current_user)


@router.get("/users", response_model=list[UserOut])
def list_users(current_user: dict = Depends(require_admin)):
    """Список всех пользователей — только для admin."""
    conn = get_connection()
    rows = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
    conn.close()
    return [UserOut(**dict(r)) for r in rows]


@router.post("/users", response_model=UserOut)
def create_user(body: UserCreate, current_user: dict = Depends(require_admin)):
    """Создать нового пользователя — только admin."""
    conn = get_connection()
    existing = conn.execute(
        "SELECT id FROM users WHERE username = ?", (body.username,)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Имя пользователя уже занято")

    cur = conn.execute(
        "INSERT INTO users (username, full_name, password, role) VALUES (?,?,?,?)",
        (body.username, body.full_name, hash_password(body.password), body.role)
    )
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return UserOut(**dict(user))


@router.put("/users/{user_id}/toggle")
def toggle_user(user_id: int, current_user: dict = Depends(require_admin)):
    """Активировать / деактивировать пользователя."""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Нельзя отключить себя")
    conn = get_connection()
    conn.execute(
        "UPDATE users SET is_active = 1 - is_active WHERE id = ?", (user_id,)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.post("/change-password")
def change_password(
    body: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    """Смена пароля текущего пользователя."""
    if current_user["password"] != hash_password(body.old_password):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    conn = get_connection()
    conn.execute(
        "UPDATE users SET password = ? WHERE id = ?",
        (hash_password(body.new_password), current_user["id"])
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.put("/users/{user_id}/password")
def admin_reset_password(
    user_id: int,
    body: dict,
    current_user: dict = Depends(require_admin)
):
    """Сброс пароля любого пользователя — только admin."""
    new_pw = body.get("new_password", "")
    if len(new_pw) < 4:
        raise HTTPException(status_code=400, detail="Пароль слишком короткий")
    conn = get_connection()
    conn.execute(
        "UPDATE users SET password = ? WHERE id = ?",
        (hash_password(new_pw), user_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}
