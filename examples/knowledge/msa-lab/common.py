from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, Iterable


SCHEMA = """
CREATE TABLE IF NOT EXISTS inbox (
    effect_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
    event_id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    payload TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS commands (
    command_id TEXT PRIMARY KEY,
    request TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS effects (
    effect_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    order_id TEXT NOT NULL,
    state TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_ledger (
    provider_key TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    state TEXT NOT NULL,
    provider_txn_id TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_refund_ledger (
    refund_key TEXT PRIMARY KEY,
    payment_key TEXT NOT NULL,
    state TEXT NOT NULL,
    provider_refund_id TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS workflow_state (
    workflow_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    step TEXT NOT NULL,
    status TEXT NOT NULL,
    ids TEXT NOT NULL,
    updated_at REAL NOT NULL
);
"""


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=5.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def json_text(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def now() -> float:
    return time.time()


def record_effect(conn: sqlite3.Connection, effect_id: str, kind: str, order_id: str, state: str, detail: Dict[str, Any]) -> Dict[str, Any]:
    existing = conn.execute("SELECT kind, order_id, detail, state FROM effects WHERE effect_id = ?", (effect_id,)).fetchone()
    if existing:
        existing_detail = json.loads(existing["detail"])
        if (existing["kind"], existing["order_id"], existing_detail) != (kind, order_id, detail):
            raise ValueError("effect_id collision: existing effect has different request")
        return {"effect_id": effect_id, "state": existing["state"], "detail": existing_detail, "duplicate": True}
    conn.execute(
        "INSERT INTO effects(effect_id, kind, order_id, state, detail, created_at) VALUES(?,?,?,?,?,?)",
        (effect_id, kind, order_id, state, json_text(detail), now()),
    )
    return {"effect_id": effect_id, "state": state, "detail": detail, "duplicate": False}


def add_outbox(conn: sqlite3.Connection, event_id: str, topic: str, payload: Dict[str, Any]) -> None:
    conn.execute("INSERT OR IGNORE INTO outbox(event_id, topic, payload, created_at) VALUES(?,?,?,?)", (event_id, topic, json_text(payload), now()))


def read_json_lines(stream: Iterable[str]) -> Iterable[Dict[str, Any]]:
    for line in stream:
        line = line.strip()
        if line:
            yield json.loads(line)
