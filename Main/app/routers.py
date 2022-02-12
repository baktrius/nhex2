import os

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
import requests

from pydantic import BaseModel
from starlette.responses import HTMLResponse, JSONResponse, Response

from .auth import authenticate_current_user

class UserCreate(BaseModel):
    username: str
    password: str

USERS_URL = os.getenv("USERS_URL")
TM_URL = os.getenv("TM_URL")

board_router = APIRouter()
auth_router = APIRouter()

@auth_router.get("/login", response_class=HTMLResponse)
async def login_html():
    pass

@auth_router.post("/login", response_class=JSONResponse)
async def do_login(form_data: OAuth2PasswordRequestForm = Depends()):
    response = requests.post(USERS_URL + "/auth/login", data={'username': form_data.username,
                                                               'password': form_data.password})
    return Response(status_code=response.status_code, content=response.content)

@auth_router.get("/register", response_class=HTMLResponse)
async def register_html():
    pass

@auth_router.post("/register", response_class=JSONResponse)
async def do_register(user: UserCreate):
    response = requests.post(USERS_URL + "/auth/register", files=user.dict())
    return JSONResponse(status_code=response.status_code, content=response.content)

# POST /board/create            -> tworzy nowy stół
#   return: (200) / (code, detail)
@board_router.post("/create", response_class=JSONResponse)
async def create_board():
    Depends(authenticate_current_user)
    response = requests.post(TM_URL + "/board/create")
    return JSONResponse(response.content, response.status_code)

# POST /board/join/<id_stołu>   -> dołącza do istniejącego stołu
#   return: (200, URL)
@board_router.get("/{board_id}/join", response_class=JSONResponse)
async def join_board(board_id: int):
    Depends(authenticate_current_user)
    response = requests.get(TM_URL + f"/board/{board_id}/join")
    return JSONResponse(response.content, response.status_code)
