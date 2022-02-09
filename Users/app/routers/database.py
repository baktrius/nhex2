from fastapi import HTTPException, status
import pymongo

from pydantic import BaseModel
from typing import Optional
import os
import uuid

from ..utils import get_password_hash

class UserFields(BaseModel):
    email: str
    username: str
    name: str
    lastname: str

class User(UserFields):
    uuid: uuid.UUID
    isActive: bool = True
    isSuperuser: bool = False


class UserCreate(UserFields):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str]
    name: Optional[str]
    lastname: Optional[str]


class UserDB(User):
    hashedPassword: str


class UserShort(BaseModel):
    username: str
    name: str
    lastname: str
    uuid: uuid.UUID


def prepare_colletion(colletion):
    colletion.create_index("username", unique=True)
    colletion.create_index("email", unique=True)
    colletion.create_index("uuid", unique=True)


DATABASE_URL = os.getenv("DATABASE_URL")

client = pymongo.MongoClient(DATABASE_URL, uuidRepresentation='standard')
db = client["platform"]

users_collection = db["users"]
prepare_colletion(users_collection)

db_testing = False
fake_users_collection = None


def get_collection():
    if not db_testing:
        return users_collection
    else:
        return fake_users_collection


def set_fake_collection():
    global db_testing, fake_users_collection
    db_testing = True
    fake_users_collection = db["fake_users"]
    prepare_colletion(fake_users_collection)


def reset_fake_collection():
    if fake_users_collection is not None:
        fake_users_collection.delete_many({})


def delete_fake_collection():
    global db_testing, fake_users_collection
    db_testing = False
    fake_users_collection = None
    db.drop_collection("fake_users")


def add_user(user: UserCreate):
    collection = get_collection()

    if collection.find_one({"username": user.username}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken"
        )

    if collection.find_one({"email": user.email}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already taken"
        )

    new_uuid = uuid.uuid4()

    while collection.find_one({"uuid": new_uuid}):
        new_uuid = uuid.uuid4()

    userDB = UserDB(
        **dict(user),
        hashedPassword=get_password_hash(user.password),
        uuid=new_uuid,
    )

    collection.insert_one(dict(userDB))

    return get_user(userDB.uuid)


def get_user(uuid: uuid.UUID = None, username: str = None):
    collection = get_collection()
    search_parameters = {
        **({} if uuid is None else {"uuid": uuid}),
        **({} if username is None else {"username": username}),
    }
    user = collection.find_one(search_parameters)
    if not user:
        return None
    return UserDB(**user)


def get_users():
    collection = get_collection()
    # users = db.find({"isActive": True})
    users = collection.find()
    return [User(**user) for user in users]

