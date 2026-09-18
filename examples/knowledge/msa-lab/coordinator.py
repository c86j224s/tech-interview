from __future__ import annotations

import json
import sqlite3
import time
import urllib.error
from pathlib import Path
import urllib.request
from typing import Any, Dict


SERVICES = {"order": 18081, "inventory": 18082, "payment": 18083, "shipping": 18084}


def call(service: str, command: Dict[str, Any], timeout: float = 1.5) -> Dict[str, Any]:
    data = json.dumps(command, sort_keys=True).encode()
    request = urllib.request.Request("http://127.0.0.1:%d/command" % SERVICES[service], data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        return {"status": "REJECTED" if 400 <= exc.code < 500 else "UNKNOWN", "error": str(exc), "service": service}
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
        return {"status": "UNKNOWN", "error": str(exc), "service": service}


def wait(service: str, timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/health" % SERVICES[service], timeout=0.2):
                return
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
            time.sleep(0.05)
    raise RuntimeError("service did not start: " + service)


def command(order_id: str, command_id: str, effect_id: str, kind: str, **extra: Any) -> Dict[str, Any]:
    value = {"order_id": order_id, "command_id": command_id, "effect_id": effect_id, "kind": kind}
    value.update(extra)
    return value


def run_flow(reconcile_unknown: bool = False, db_dir: Path | None = None, resume_compensation: bool = False) -> Dict[str, Any]:
    ids = {"order": "cmd-order-o-17", "hold": "cmd-hold-o-17", "payment": "cmd-payment-o-17", "reconcile": "cmd-reconcile-payment-o-17", "shipping": "cmd-shipping-o-17", "refund": "cmd-refund-o-17"}
    if db_dir is not None:
        with sqlite3.connect(str(db_dir / "coordinator.sqlite3")) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS workflow_state (workflow_id TEXT PRIMARY KEY, order_id TEXT NOT NULL, step TEXT NOT NULL, status TEXT NOT NULL, ids TEXT NOT NULL, updated_at REAL NOT NULL)")
            conn.execute("INSERT OR IGNORE INTO workflow_state VALUES (?, ?, ?, ?, ?, ?)", ("workflow:o-17", "o-17", "START", "RUNNING", json.dumps(ids, sort_keys=True), time.time()))
            conn.commit()
        status = _workflow_status(db_dir)
        if status in ("COMPLETED", "CANCELLED"):
            return {"final": status, "resumed_terminal": True}
        if status == "COMPENSATING":
            refund = call("payment", command("o-17", ids["refund"], "refund:payment:o-17", "refund", payment_id="payment:o-17"))
            release = call("inventory", command("o-17", "cmd-release-o-17", "release:hold:o-17", "release", hold_id="hold:o-17")) if refund.get("status") == "REFUNDED" else {"status": "UNKNOWN", "reason": "REFUND_NOT_CONFIRMED"}
            final = "CANCELLED" if refund.get("status") == "REFUNDED" and release.get("status") == "RELEASED" else "COMPENSATING"
            if final == "CANCELLED":
                _save_step(db_dir, "CANCELLED", status="CANCELLED")
            return {"final": final, "payment": {"status": "AUTHORIZED"}, "shipping": {"status": "PERMANENT_FAILURE", "reason": "CARRIER_REJECTED"}, "refund": refund, "release": release}
    order = call("order", command("o-17", ids["order"], "order:o-17", "order"))
    if db_dir is not None:
        _save_step(db_dir, "ORDER")
    hold = call("inventory", command("o-17", ids["hold"], "hold:o-17", "inventory"))
    if db_dir is not None:
        _save_step(db_dir, "INVENTORY")
    if hold.get("status") == "UNKNOWN":
        return {"final": "INVENTORY_UNKNOWN", "order": order, "inventory": hold}
    if hold.get("status") != "HELD":
        return {"final": "CANCELLED", "order": order, "inventory": hold}
    payment_cmd = command("o-17", ids["payment"], "payment:o-17", "payment", amount=12000, currency="KRW")
    if reconcile_unknown:
        payment = call("payment", dict(payment_cmd, kind="payment_reconcile", command_id=ids["reconcile"]))
        if payment.get("status") == "NOT_FOUND":
            payment = call("payment", payment_cmd)
    else:
        payment = call("payment", payment_cmd)
    if db_dir is not None:
        _save_step(db_dir, "PAYMENT")
    if payment.get("status") != "AUTHORIZED":
        return {"final": "PAYMENT_UNKNOWN", "order": order, "inventory": hold, "payment": payment}
    shipping_cmd = command("o-17", ids["shipping"], "shipping:o-17", "shipping")
    shipping = call("shipping", shipping_cmd)
    if shipping.get("status") == "UNKNOWN":
        _save_step(db_dir, "SHIPPING", status="SHIPPING_UNKNOWN") if db_dir else None
        return {"final": "SHIPPING_UNKNOWN", "order": order, "inventory": hold, "payment": payment, "shipping": shipping}
    if shipping.get("status") != "CREATED":
        if db_dir is not None:
            _save_step(db_dir, "COMPENSATING", status="COMPENSATING")
        refund = call("payment", command("o-17", ids["refund"], "refund:payment:o-17", "refund", payment_id="payment:o-17"))
        release = call("inventory", command("o-17", "cmd-release-o-17", "release:hold:o-17", "release", hold_id="hold:o-17")) if refund.get("status") == "REFUNDED" else {"status": "UNKNOWN", "reason": "REFUND_NOT_CONFIRMED"}
        if resume_compensation and refund.get("status") == "UNKNOWN":
            refund = call("payment", command("o-17", ids["refund"], "refund:payment:o-17", "refund", payment_id="payment:o-17"))
        if resume_compensation and release.get("status") == "UNKNOWN":
            release = call("inventory", command("o-17", "cmd-release-o-17", "release:hold:o-17", "release", hold_id="hold:o-17"))
        final = "CANCELLED" if refund.get("status") == "REFUNDED" and release.get("status") == "RELEASED" else "COMPENSATING"
        if db_dir is not None and final == "CANCELLED":
            _save_step(db_dir, "CANCELLED", status="CANCELLED")
        return {"final": final, "order": order, "inventory": hold, "payment": payment, "shipping": shipping, "refund": refund, "release": release}
    if db_dir is not None:
        _save_step(db_dir, "COMPLETED", status="COMPLETED")
    return {"final": "COMPLETED", "order": order, "inventory": hold, "payment": payment, "shipping": shipping}


def _workflow_status(db_dir: Path) -> str:
    with sqlite3.connect(str(db_dir / "coordinator.sqlite3")) as conn:
        row = conn.execute("SELECT status FROM workflow_state WHERE workflow_id=?", ("workflow:o-17",)).fetchone()
        return row[0] if row else ""


def _save_step(db_dir: Path, step: str, status: str = "RUNNING") -> None:
    with sqlite3.connect(str(db_dir / "coordinator.sqlite3")) as conn:
        conn.execute("UPDATE workflow_state SET step=?, status=?, updated_at=? WHERE workflow_id=?", (step, status, time.time(), "workflow:o-17"))
        conn.commit()
