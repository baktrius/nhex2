from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from starlette import status
import requests
import os

USERS_URL = os.getenv("USERS_URL")

security = HTTPBearer()

async def authenticate_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    response = requests.get(f"{USERS_URL}/info?token={token}")
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    else:
        return


