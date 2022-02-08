from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from uuid import UUID
from typing import List, Union

from ..utils import is_valid_email
from .database import User, UserCreate, UserShort, add_user, get_user, get_users
from .auth import authenticate_user, Token, get_current_active_user, create_access_token, \
    get_current_superuser, UserNotLogged, UserInfo, user_info
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

    access_token = create_access_token(data={"sub": user.username})
    token_model = Token(access_token=access_token, token_type="bearer")
    await open_session(access_token)

    return token_model


@auth_router.post("/register", response_model=User)
async def register(user: UserCreate):
    if not is_valid_email(user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is not correct"
        )

    return add_user(user)


@query_router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@query_router.get("/all", response_model=List[UserShort])
async def get_all_users(_: User = Depends(get_current_superuser)):
    return get_users()


@query_router.get("/{uuid}", response_model=User)
async def get_user_by_uuid(uuid: UUID, _: User = Depends(get_current_superuser)):
    return get_user(uuid)
