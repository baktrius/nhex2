from fastapi import HTTPException, status
import pymongo

from pydantic import BaseModel
import os
from uuid import UUID, uuid4

from ..utils import get_password_hash

class UserFields(BaseModel):
    username: str

class User(UserFields):
    uuid: UUID

class UserCreate(BaseModel):
    username: str
    password: str

class UserDB(User):
    hashedPassword: str

def prepare_collection(collection):
    collection.create_index("username", unique=True)
    collection.create_index("uuid", unique=True)


DATABASE_URL = os.getenv("DATABASE_URL")

client = pymongo.MongoClient(DATABASE_URL, uuidRepresentation='standard')
db = client["platform"]

users_collection = db["users"]
prepare_collection(users_collection)

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
    prepare_collection(fake_users_collection)


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

    new_uuid = uuid4()

    while collection.find_one({"uuid": new_uuid}):
        new_uuid = uuid4()

    userDB = UserDB(
        **dict(user),
        hashedPassword=get_password_hash(user.password),
        uuid=new_uuid,
    )

    collection.insert_one(dict(userDB))

    return get_user(userDB.uuid)


def get_user(uuid: UUID = None, username: str = None):
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

