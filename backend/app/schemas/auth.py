from pydantic import BaseModel, Field

from app.core.enums import RegType, Role


class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(default="", max_length=128)
    phone: str = Field(default="", max_length=32)
    passport: str | None = Field(default=None, max_length=256)
    reg_type: RegType
    tg_init_data: str = Field(max_length=4096)


class UserOut(BaseModel):
    id: int
    telegram_id: int
    first_name: str
    last_name: str
    phone: str
    role: Role
    carrier_number: int | None = None
    is_active: bool
    username: str | None = None  # sayt login (o'rnatilgan bo'lsa)


class RegisterResponse(BaseModel):
    token: str
    user: UserOut
