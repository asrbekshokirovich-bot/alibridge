"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-06

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("first_name", sa.String(length=128), nullable=False),
        sa.Column("last_name", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("phone", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("passport", sa.String(length=256), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("carrier_number", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("telegram_id"),
        sa.UniqueConstraint("carrier_number"),
    )
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"])
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("barcode", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("category", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("type", sa.String(length=16), nullable=False, server_default="piece"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("weight_kg", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("unit_weight_kg", sa.Numeric(18, 4), nullable=True),
        sa.Column("box_weight_kg", sa.Numeric(18, 4), nullable=True),
        sa.Column("cargo_price", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column(
            "status", sa.String(length=32), nullable=False, server_default="in_warehouse_uz"
        ),
        sa.Column("received_date", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("image_url", sa.String(length=512), nullable=True),
        sa.Column("custody_holder_type", sa.String(length=32), nullable=True),
        sa.Column("custody_holder_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("barcode"),
    )
    op.create_index("ix_products_barcode", "products", ["barcode"])
    op.create_index("ix_products_status", "products", ["status"])

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("carrier_id", sa.Integer(), nullable=False),
        sa.Column("pickup_type", sa.String(length=16), nullable=False, server_default="self"),
        sa.Column("pickup_address", sa.String(length=512), nullable=True),
        sa.Column(
            "delivery_address_tr", sa.String(length=512), nullable=False, server_default=""
        ),
        sa.Column(
            "status", sa.String(length=32), nullable=False, server_default="pending_admin"
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["carrier_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_orders_carrier_id", "orders", ["carrier_id"])
    op.create_index("ix_orders_status", "orders", ["status"])

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("actual_quantity", sa.Integer(), nullable=True),
        sa.Column("locked_cargo_price", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])
    op.create_index("ix_order_items_product_id", "order_items", ["product_id"])

    op.create_table(
        "disputes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("carrier_id", sa.Integer(), nullable=True),
        sa.Column("reported_by", sa.Integer(), nullable=True),
        sa.Column("barcode", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["carrier_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reported_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_disputes_status", "disputes", ["status"])

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("carrier_id", sa.Integer(), nullable=False),
        sa.Column("products_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="unpaid"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["carrier_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payments_carrier_id", "payments", ["carrier_id"])
    op.create_index("ix_payments_status", "payments", ["status"])

    op.create_table(
        "walk_in_customers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "staff_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_staff_requests_user_id", "staff_requests", ["user_id"])
    op.create_index("ix_staff_requests_status", "staff_requests", ["status"])

    op.create_table(
        "custody_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("from_holder_type", sa.String(length=32), nullable=True),
        sa.Column("from_holder_id", sa.Integer(), nullable=True),
        sa.Column("to_holder_type", sa.String(length=32), nullable=True),
        sa.Column("to_holder_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("scanned_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["scanned_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_custody_events_product_id", "custody_events", ["product_id"])

    op.create_table(
        "counters",
        sa.Column("name", sa.String(length=32), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("name"),
    )

    # custody_events — APPEND ONLY (invariant). UPDATE/DELETE taqiqlanadi.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_custody_update_delete()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                RAISE EXCEPTION 'custody_events table is append-only: UPDATE is not allowed';
            ELSIF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'custody_events table is append-only: DELETE is not allowed';
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER enforce_custody_append_only
            BEFORE UPDATE OR DELETE ON custody_events
            FOR EACH ROW EXECUTE FUNCTION prevent_custody_update_delete();
        """
    )

    # Hisoblagichlar boshlang'ich qiymatlari
    op.execute("INSERT INTO counters (name, value) VALUES ('barcode', 100000)")
    op.execute("INSERT INTO counters (name, value) VALUES ('carrier_number', 0)")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS enforce_custody_append_only ON custody_events")
    op.execute("DROP FUNCTION IF EXISTS prevent_custody_update_delete()")
    op.drop_table("counters")
    op.drop_index("ix_custody_events_product_id", table_name="custody_events")
    op.drop_table("custody_events")
    op.drop_index("ix_staff_requests_status", table_name="staff_requests")
    op.drop_index("ix_staff_requests_user_id", table_name="staff_requests")
    op.drop_table("staff_requests")
    op.drop_table("walk_in_customers")
    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_index("ix_payments_carrier_id", table_name="payments")
    op.drop_table("payments")
    op.drop_index("ix_disputes_status", table_name="disputes")
    op.drop_table("disputes")
    op.drop_index("ix_order_items_product_id", table_name="order_items")
    op.drop_index("ix_order_items_order_id", table_name="order_items")
    op.drop_table("order_items")
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_index("ix_orders_carrier_id", table_name="orders")
    op.drop_table("orders")
    op.drop_index("ix_products_status", table_name="products")
    op.drop_index("ix_products_barcode", table_name="products")
    op.drop_table("products")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_telegram_id", table_name="users")
    op.drop_table("users")
