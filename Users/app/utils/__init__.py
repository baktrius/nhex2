import datetime
import pytz
from passlib.context import CryptContext
import re

timezone = pytz.timezone("Europe/Warsaw")


def now_timestamp():
    return datetime.datetime.now(tz=timezone).timestamp()


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)
