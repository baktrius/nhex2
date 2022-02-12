import random

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from typing import Union

from .database import User, UserCreate, add_user, get_user, get_users
from .auth import authenticate_user, Token, create_access_token, UserNotLogged, UserInfo, user_info, get_current_user
from .sessions import open_session

query_router = APIRouter()
auth_router = APIRouter()

@auth_router.post("/refresh")

@auth_router.get("/info", response_model=Union[UserNotLogged, UserInfo])
async def info(token: str):
    return await user_info(token)


@auth_router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.username, "salt": random.randint(0, 10000000)})
    token_model = Token(access_token=access_token, token_type="bearer")
    await open_session(access_token)

    return token_model

@auth_router.post("/register", response_model=User)
async def register(user: UserCreate):
    return add_user(user)

@query_router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user