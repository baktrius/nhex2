import redis
import os

REDIS_URL = os.getenv("REDIS_URL")
assert REDIS_URL is not None

r = redis.Redis(host=REDIS_URL)

EXPIRATION_TIMEOUT_MINUTES = 30
EXPIRATION_TIMEOUT_SECONDS = 60 * EXPIRATION_TIMEOUT_MINUTES

async def set_or_refresh_token(token: str):
    r.set(token, b"", ex=EXPIRATION_TIMEOUT_SECONDS)

async def open_session(token: str):
    return await set_or_refresh_token(token)

async def refresh_session(token: str):
    return await set_or_refresh_token(token)

async def is_session_active(token: str):
    return r.get(token) is not None