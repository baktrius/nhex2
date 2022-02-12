import requests
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from starlette.responses import HTMLResponse, JSONResponse

from .auth import authenticate_current_user
from .routers import board_router, auth_router, TM_URL

app = FastAPI()

origins = [
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    auth_router,
    prefix="/auth",
    tags=["auth"]
)

app.include_router(
    board_router,
    prefix="/board",
    tags=["board"]
)

for route in app.routes:
    if isinstance(route, APIRoute):
        route.operation_id = route.name

@app.get("/", response_class=HTMLResponse)
async def mainpage():
    pass

@app.get("/whiteboard/{board_id}", response_class=HTMLResponse)
async def whiteboard(board_id: int):
    Depends(authenticate_current_user)
    pass

# GET  /boards/active        -> daje listę aktywnych stołów
#   return: (200, URL)
@app.get("/boards/active", response_class=JSONResponse)
async def active_boards():
    Depends(authenticate_current_user)
    response = requests.get(TM_URL + "/boards")
    return JSONResponse(content=response.content, status_code=response.status_code,
                        headers=response.headers)

# REST API serwisu Main
#
# Funkcjonalności:
# Klient może:
# - rysować za pomocą klienta do rysowania
# - się zalogować, rejestrować, wylogować
# - utworzyć stół (tylko publiczny), dołączyć do stołu
# - pobrać listę stołów (prośba o adres metastołu)
#
# Main musi:
# - serwować statyczne pliki (strona główna, strona logowania, klient tablicy)
# - wystawiać API logowania, rejestracji, wylogowania
# - wystawiać API utworzenia stołu, dołączenia do stołu
# - wystawiać API podania adresu TSSa synchronizującego metastół

# GET  /auth/login              -> daje stronę logowania
#   return: HTML response
# POST /auth/login              -> loguje i zwraca JWT token sesyjny
#   return: (200, token: JWT token) / (401, detail)
# GET  /auth/register           -> daje stronę rejestracji
#   return: HTML response
# POST /auth/register           -> rejestruje
#   return: (200) / (other_code, detail)

# GET  /                        -> daje stronę główną
#   return: HTML response

# POST /board/create            -> tworzy nowy stół
#   return: (200) / (code, detail)
# POST /board/join/<id_stołu>   -> dołącza do istniejącego stołu
#   return: (200, URL)

# GET  /boards/active           -> daje listę aktywnych stołów
#   return: (200, <JSON>)
# GET  /whiteboard/<id_stołu>   -> daje klienta tablicy
#   return: HTML response
