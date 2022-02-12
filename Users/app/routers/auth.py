from fastapi import Depends, status, HTTPException, Request, WebSocket
from fastapi.security import OAuth2PasswordBearer

from jose import JWTError, jwt
from typing import Optional, Union
from pydantic import BaseModel

from .database import User, get_user, UserFields
from ..utils import verify_password
from .sessions import is_session_active

import os

# to get a string like this run:
# openssl rand -hex 32
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

class UserNotLogged(BaseModel):
    success: bool
    reason: str

class UserInfo(BaseModel):
    success: bool
    user: UserFields

class Token(BaseModel):
    access_token: str
    token_type: str
    

class TokenData(BaseModel):
    username: str


class AuthBearer(OAuth2PasswordBearer):
    async def __call__(self,
                       request: Request = None,
                       websocket: WebSocket = None
                       ) -> Optional[str]:
        request = request or websocket
        if not request:
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authenticated"
                )
            return None
        return await super().__call__(request)


oauth2_scheme = AuthBearer(tokenUrl="auth/login")


def authenticate_user(username: str, password: str):
    user = get_user(username=username)
    if not user:
        return False
    elif not verify_password(password, user.hashedPassword):
        return False
    return user


def create_access_token(data: dict):
    to_encode = data.copy()
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        token_data = TokenData(username=username)
        user = get_user(username=token_data.username)
        return user
    except JWTError:
        return None


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user = get_user_from_token(token)
    if user is None:
        raise credentials_exception
    return user


async def user_info(token: str) -> Union[UserInfo, UserNotLogged]:
    user = get_user_from_token(token)
    if not user:
        return UserNotLogged(success=False, reason="no such user")
    session_active = await is_session_active(token)
    if not session_active:
        return UserNotLogged(success=False, reason="session expired")
    else:
        attrs = {key: user.__getattribute__(key) for key in (
            "username", "email", "name", "lastname"
        )}
        return UserInfo(success=True, user=user)

