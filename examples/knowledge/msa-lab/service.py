from __future__ import annotations

import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict

from common import add_outbox, connect, json_text, now, record_effect


class State:
    def __init__(self, name: str, db_dir, failpoint: str = "") -> None:
        self.name = name
        self.conn = connect(db_dir / (name + ".sqlite3"))
        self.failpoint = failpoint

    def has_failpoint(self, point: str) -> bool:
        return point in {item.strip() for item in self.failpoint.split(",") if item.strip()}

    def stop_after(self, point: str) -> None:
        if self.has_failpoint(point):
            os._exit(17)

    def _prior(self, command: Dict[str, Any], conn=None):
        conn = conn or self.conn
        request_text = json_text(command)
        prior = conn.execute("SELECT request, result FROM commands WHERE command_id = ?", (command["command_id"],)).fetchone()
        if prior:
            if prior["request"] != request_text:
                raise ValueError("command_id collision: existing command has different request")
            return json.loads(prior["result"])
        return None

    def inventory(self, command: Dict[str, Any]) -> Dict[str, Any]:
        order_id, command_id, effect_id = command["order_id"], command["command_id"], command["effect_id"]
        request_text = json_text(command)
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            prior = self._prior(command)
            if prior is not None:
                self.conn.commit()
                return prior
            row = self.conn.execute("SELECT kind, order_id, detail FROM effects WHERE effect_id = ?", (effect_id,)).fetchone()
            if row:
                if (row["kind"], row["order_id"]) != ("hold", order_id):
                    raise ValueError("hold identity collision")
                result = json.loads(row["detail"])
            else:
                available = self.conn.execute("SELECT detail FROM effects WHERE effect_id = 'stock:SKU-A'").fetchone()
                quantity = int(json.loads(available["detail"])["available"]) if available else 1
                if quantity < 1:
                    result = {"status": "REJECTED", "reason": "INSUFFICIENT_STOCK", "order_id": order_id}
                else:
                    self.conn.execute("DELETE FROM effects WHERE effect_id = 'stock:SKU-A'")
                    self.conn.execute("INSERT INTO effects(effect_id, kind, order_id, state, detail, created_at) VALUES(?,?,?,?,?,?)", ("stock:SKU-A", "stock", order_id, "AVAILABLE", json_text({"available": quantity - 1}), now()))
                    result = {"status": "HELD", "order_id": order_id, "hold_id": effect_id, "generation": 1}
                self.conn.execute("INSERT INTO effects(effect_id, kind, order_id, state, detail, created_at) VALUES(?,?,?,?,?,?)", (effect_id, "hold", order_id, result["status"], json_text(result), now()))
            self.conn.execute("INSERT INTO commands(command_id, request, result, created_at) VALUES(?,?,?,?)", (command_id, request_text, json_text(result), now()))
            add_outbox(self.conn, "evt:" + command_id, "inventory.result", result)
            self.conn.commit()
            return result
        except Exception:
            self.conn.rollback()
            raise

    def payment(self, command: Dict[str, Any]) -> Dict[str, Any]:
        order_id, command_id, effect_id = command["order_id"], command["command_id"], command["effect_id"]
        request_text = json_text(command)
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            prior = self._prior(command)
            if prior is not None:
                self.conn.commit()
                return prior
            provider_key = effect_id
            amount, currency = command["amount"], command["currency"]
            if type(amount) is not int or not 0 < amount <= 1_000_000_000 or currency != "KRW":
                raise ValueError("this lab accepts positive integer KRW amounts only")
            ledger = self.conn.execute("SELECT * FROM provider_ledger WHERE provider_key = ?", (provider_key,)).fetchone()
            if ledger and (ledger["order_id"], ledger["amount"], ledger["currency"]) != (order_id, amount, currency):
                raise ValueError("provider idempotency key collision: existing request differs")
            if ledger is None:
                self.stop_after("payment-before-effect")
                provider_txn_id = "ptxn:" + provider_key
                self.conn.execute("INSERT INTO provider_ledger(provider_key, order_id, amount, currency, state, provider_txn_id, created_at) VALUES(?,?,?,?,?,?,?)", (provider_key, order_id, amount, currency, "AUTHORIZED", provider_txn_id, now()))
            else:
                provider_txn_id = ledger["provider_txn_id"]
            detail = {"provider": "mock", "provider_txn_id": provider_txn_id, "amount": amount, "currency": currency}
            result = record_effect(self.conn, effect_id, "mock_payment", order_id, "AUTHORIZED", detail)
            result.update({"status": "AUTHORIZED", "order_id": order_id, "provider_txn_id": provider_txn_id})
            self.conn.execute("INSERT INTO commands(command_id, request, result, created_at) VALUES(?,?,?,?)", (command_id, request_text, json_text(result), now()))
            add_outbox(self.conn, "evt:" + command_id, "payment.result", result)
            self.conn.commit()
            self.stop_after("payment-after-commit")
            return result
        except SystemExit:
            raise
        except Exception:
            self.conn.rollback()
            raise

    def payment_reconcile(self, command: Dict[str, Any]) -> Dict[str, Any]:
        request_text = json_text(command)
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            prior = self._prior(command)
            if prior is not None:
                self.conn.commit()
                return prior
            payment = self.conn.execute("SELECT * FROM provider_ledger WHERE provider_key = ?", (command["effect_id"],)).fetchone()
            if payment is None:
                self.conn.commit()
                # Absence is a current observation, not an immutable command result.
                return {"status": "NOT_FOUND", "order_id": command["order_id"], "effect_id": command["effect_id"]}
            else:
                if (payment["order_id"], payment["amount"], payment["currency"]) != (command["order_id"], int(command["amount"]), command["currency"]):
                    raise ValueError("provider idempotency key collision: existing request differs")
                detail = {"provider": "mock", "provider_txn_id": payment["provider_txn_id"], "amount": payment["amount"], "currency": payment["currency"]}
                recorded = record_effect(self.conn, command["effect_id"], "mock_payment", command["order_id"], payment["state"], detail)
                result = dict(recorded, status=payment["state"], order_id=command["order_id"], provider_txn_id=payment["provider_txn_id"], reconciled=True)
            self.conn.execute("INSERT INTO commands(command_id, request, result, created_at) VALUES(?,?,?,?)", (command["command_id"], request_text, json_text(result), now()))
            add_outbox(self.conn, "evt:" + command["command_id"], "payment.reconciled", result)
            self.conn.commit()
            return result
        except Exception:
            self.conn.rollback()
            raise

    def refund(self, command: Dict[str, Any]) -> Dict[str, Any]:
        request_text = json_text(command)
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            prior = self._prior(command)
            if prior is not None:
                self.conn.commit()
                return prior
            payment = self.conn.execute("SELECT * FROM provider_ledger WHERE provider_key = ?", (command["payment_id"],)).fetchone()
            if payment is None:
                raise ValueError("payment not found for refund")
            self.stop_after("refund-before-effect")
            refund_key = command["effect_id"]
            existing = self.conn.execute("SELECT * FROM provider_refund_ledger WHERE refund_key = ?", (refund_key,)).fetchone()
            if existing:
                if existing["payment_key"] != command["payment_id"]:
                    raise ValueError("refund idempotency key collision: existing request differs")
                provider_refund_id = existing["provider_refund_id"]
            else:
                provider_refund_id = "prefund:" + refund_key
                self.conn.execute("INSERT INTO provider_refund_ledger(refund_key, payment_key, state, provider_refund_id, created_at) VALUES(?,?,?,?,?)", (refund_key, command["payment_id"], "REFUNDED", provider_refund_id, now()))
            result = record_effect(self.conn, refund_key, "mock_refund", command["order_id"], "REFUNDED", {"payment_id": command["payment_id"], "provider_refund_id": provider_refund_id})
            result.update({"status": "REFUNDED", "order_id": command["order_id"], "provider_refund_id": provider_refund_id})
            self.conn.execute("INSERT INTO commands(command_id, request, result, created_at) VALUES(?,?,?,?)", (command["command_id"], request_text, json_text(result), now()))
            add_outbox(self.conn, "evt:" + command["command_id"], "payment.refund.result", result)
            self.conn.commit()
            self.stop_after("refund-after-effect")
            return result
        except SystemExit:
            raise
        except Exception:
            self.conn.rollback()
            raise

    def order(self, command: Dict[str, Any]) -> Dict[str, Any]:
        return self.simple(command, {"status": "ACCEPTED", "order_id": command["order_id"]}, "order.result")

    def shipping(self, command: Dict[str, Any]) -> Dict[str, Any]:
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            prior = self._prior(command)
            if prior is not None:
                self.conn.commit()
                return prior
            if self.failpoint == "shipping-permanent-failure":
                result = {"status": "PERMANENT_FAILURE", "order_id": command["order_id"], "reason": "CARRIER_REJECTED"}
                self.conn.execute("INSERT INTO effects(effect_id, kind, order_id, state, detail, created_at) VALUES(?,?,?,?,?,?)", (command["effect_id"], "shipping", command["order_id"], "FAILED", json_text(result), now()))
            else:
                result = record_effect(self.conn, command["effect_id"], "shipping", command["order_id"], "CREATED", {"shipment_id": command["effect_id"]})
                result.update({"status": "CREATED", "order_id": command["order_id"]})
            self.conn.execute("INSERT INTO commands(command_id, request, result, created_at) VALUES(?,?,?,?)", (command["command_id"], json_text(command), json_text(result), now()))
            add_outbox(self.conn, "evt:" + command["command_id"], "shipping.result", result)
            self.conn.commit()
            return result
        except Exception:
            self.conn.rollback()
            raise

    def release(self, command: Dict[str, Any]) -> Dict[str, Any]:
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            prior = self._prior(command)
            if prior is not None:
                self.conn.commit()
                return prior
            hold = self.conn.execute("SELECT state, detail FROM effects WHERE effect_id = ?", (command["hold_id"],)).fetchone()
            if hold is None:
                raise ValueError("hold not found for release")
            if hold["state"] == "HELD":
                stock = self.conn.execute("SELECT detail FROM effects WHERE effect_id = 'stock:SKU-A'").fetchone()
                available = int(json.loads(stock["detail"])["available"]) if stock else 0
                self.conn.execute("DELETE FROM effects WHERE effect_id = 'stock:SKU-A'")
                self.conn.execute("INSERT INTO effects(effect_id, kind, order_id, state, detail, created_at) VALUES(?,?,?,?,?,?)", ("stock:SKU-A", "stock", command["order_id"], "AVAILABLE", json_text({"available": available + 1}), now()))
                self.conn.execute("UPDATE effects SET state='RELEASED', detail=? WHERE effect_id=?", (json_text({"status": "RELEASED", "order_id": command["order_id"], "hold_id": command["hold_id"]}), command["hold_id"]))
            result = record_effect(self.conn, command["effect_id"], "release", command["order_id"], "RELEASED", {"hold_id": command["hold_id"]})
            result.update({"status": "RELEASED", "order_id": command["order_id"], "hold_id": command["hold_id"]})
            self.conn.execute("INSERT INTO commands(command_id, request, result, created_at) VALUES(?,?,?,?)", (command["command_id"], json_text(command), json_text(result), now()))
            add_outbox(self.conn, "evt:" + command["command_id"], "inventory.release.result", result)
            self.conn.commit()
            return result
        except Exception:
            self.conn.rollback()
            raise

    def simple(self, command: Dict[str, Any], result: Dict[str, Any], topic: str) -> Dict[str, Any]:
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            prior = self._prior(command)
            if prior is not None:
                self.conn.commit()
                return prior
            self.conn.execute("INSERT INTO commands(command_id, request, result, created_at) VALUES(?,?,?,?)", (command["command_id"], json_text(command), json_text(result), now()))
            add_outbox(self.conn, "evt:" + command["command_id"], topic, result)
            self.conn.commit()
            return result
        except Exception:
            self.conn.rollback()
            raise


class Handler(BaseHTTPRequestHandler):
    state: State

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_error(404)
            return
        body = json_text({"service": self.state.name, "status": "ok"}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        self.connection.settimeout(2)
        if self.path != "/command":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 16_384:
                self.send_error(413)
                return
            command = json.loads(self.rfile.read(length))
            allowed = {"order": {"order"}, "inventory": {"inventory", "release"}, "payment": {"payment", "payment_reconcile", "refund"}, "shipping": {"shipping"}}
            if not isinstance(command, dict) or command.get("kind") not in allowed[self.state.name]:
                raise ValueError("command is not allowed for this service")
            result = getattr(self.state, command["kind"])(command)
            body = json_text(result).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (KeyError, ValueError, json.JSONDecodeError) as exc:
            self.send_error(400, str(exc))
        except Exception as exc:
            self.send_error(500, str(exc))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--service", choices=["order", "inventory", "payment", "shipping"], required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--db-dir", required=True, type=__import__("pathlib").Path)
    parser.add_argument("--failpoint", choices=["", "payment-before-effect", "payment-after-commit", "shipping-permanent-failure", "refund-before-effect", "refund-after-effect"], default="")
    args = parser.parse_args()
    state = State(args.service, args.db_dir, args.failpoint)
    handler = type("ServiceHandler", (Handler,), {"state": state})
    server = HTTPServer(("127.0.0.1", args.port), handler)
    server.daemon_threads = True
    try:
        server.serve_forever(poll_interval=0.1)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        state.conn.close()


if __name__ == "__main__":
    main()
