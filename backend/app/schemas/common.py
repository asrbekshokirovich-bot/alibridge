from pydantic import BaseModel


class OkResponse(BaseModel):
    ok: bool = True


class OrderCreatedResponse(BaseModel):
    ok: bool = True
    order_id: int
