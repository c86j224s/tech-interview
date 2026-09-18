from __future__ import annotations

import json
import sqlite3
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

from coordinator import SERVICES, call, command, run_flow, wait


ROOT = Path(__file__).resolve().parent


class ProcessHarness:
    def __init__(self, db_dir: Path, failpoint: str = "") -> None:
        self.db_dir = db_dir
        self.failpoint = failpoint
        self.processes = []

    def start(self) -> None:
        for service, port in SERVICES.items():
            target_failpoint = self.failpoint.split(",", 1)[1] if service == "payment" and "," in self.failpoint else (self.failpoint if service in ("payment", "shipping") else "")
            if service == "payment" and self.failpoint.startswith("shipping-permanent-failure"):
                target_failpoint = self.failpoint.split(",", 1)[1] if "," in self.failpoint else ""
            if service == "shipping" and self.failpoint.startswith("shipping-permanent-failure"):
                target_failpoint = "shipping-permanent-failure"
            self.processes.append(subprocess.Popen([sys.executable, str(ROOT / "service.py"), "--service", service, "--port", str(port), "--db-dir", str(self.db_dir), "--failpoint", target_failpoint], cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        try:
            for service in SERVICES:
                wait(service, timeout=5)
        except Exception:
            self.stop()
            raise

    def stop(self) -> None:
        for process in self.processes:
            if process.poll() is None:
                process.terminate()
        for process in self.processes:
            if process.poll() is None:
                try:
                    process.wait(timeout=0.5)
                except subprocess.TimeoutExpired:
                    process.kill()
        for process in self.processes:
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=2)
        self.processes = []


class SagaLabTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.db_dir = Path(self.temp.name) / "data"

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_idempotent_effect_outbox_and_payload_collision(self) -> None:
        harness = ProcessHarness(self.db_dir)
        harness.start()
        try:
            first = call("payment", command("o-17", "cmd-1", "payment:o-17", "payment", amount=12000, currency="KRW"))
            second = call("payment", command("o-17", "cmd-1", "payment:o-17", "payment", amount=12000, currency="KRW"))
            collision = call("payment", command("o-17", "cmd-1", "payment:o-17", "payment", amount=13000, currency="KRW"))
            self.assertEqual(first["status"], "AUTHORIZED")
            self.assertEqual(second["status"], "AUTHORIZED")
            self.assertEqual(collision["status"], "REJECTED")
            with sqlite3.connect(str(self.db_dir / "payment.sqlite3")) as conn:
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM effects WHERE effect_id='payment:o-17'").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM provider_ledger WHERE provider_key='payment:o-17'").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM outbox WHERE event_id='evt:cmd-1'").fetchone()[0], 1)
        finally:
            harness.stop()

    def test_restart_reconciles_after_commit_without_duplicate_charge(self) -> None:
        harness = ProcessHarness(self.db_dir, "payment-after-commit")
        harness.start()
        try:
            first = run_flow(db_dir=self.db_dir)
            self.assertEqual(first["final"], "PAYMENT_UNKNOWN")
        finally:
            harness.stop()
        restarted = ProcessHarness(self.db_dir)
        restarted.start()
        try:
            second = run_flow(reconcile_unknown=True, db_dir=self.db_dir)
            self.assertEqual(second["final"], "COMPLETED")
            self.assertTrue(second["payment"].get("reconciled"))
        finally:
            restarted.stop()
        with sqlite3.connect(str(self.db_dir / "payment.sqlite3")) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM provider_ledger WHERE provider_key='payment:o-17'").fetchone()[0], 1)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM effects WHERE effect_id='payment:o-17'").fetchone()[0], 1)

    def test_restart_retries_before_effect_and_completes(self) -> None:
        harness = ProcessHarness(self.db_dir, "payment-before-effect")
        harness.start()
        try:
            first = run_flow(db_dir=self.db_dir)
            self.assertEqual(first["final"], "PAYMENT_UNKNOWN")
        finally:
            harness.stop()
        restarted = ProcessHarness(self.db_dir)
        restarted.start()
        try:
            second = run_flow(reconcile_unknown=True, db_dir=self.db_dir)
            self.assertEqual(second["final"], "COMPLETED")
        finally:
            restarted.stop()
        with sqlite3.connect(str(self.db_dir / "payment.sqlite3")) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM provider_ledger WHERE provider_key='payment:o-17'").fetchone()[0], 1)

    def test_compensation_restart_refund_failpoints_and_release_once(self) -> None:
        for failpoint in ("refund-before-effect", "refund-after-effect"):
            with self.subTest(failpoint=failpoint):
                self.db_dir = Path(self.temp.name) / failpoint
                harness = ProcessHarness(self.db_dir, "shipping-permanent-failure," + failpoint)
                harness.start()
                try:
                    first = run_flow(db_dir=self.db_dir)
                    self.assertEqual(first["shipping"]["status"], "PERMANENT_FAILURE")
                    self.assertIn(first["final"], ("COMPENSATING", "CANCELLED"))
                finally:
                    harness.stop()
                restarted = ProcessHarness(self.db_dir)
                restarted.start()
                try:
                    second = run_flow(db_dir=self.db_dir, resume_compensation=True)
                    self.assertEqual(second["final"], "CANCELLED")
                finally:
                    restarted.stop()
                with sqlite3.connect(str(self.db_dir / "payment.sqlite3")) as conn:
                    self.assertEqual(conn.execute("SELECT COUNT(*) FROM effects WHERE effect_id='refund:payment:o-17'").fetchone()[0], 1)
                    self.assertEqual(conn.execute("SELECT COUNT(*) FROM provider_refund_ledger WHERE refund_key='refund:payment:o-17'").fetchone()[0], 1)
                with sqlite3.connect(str(self.db_dir / "inventory.sqlite3")) as conn:
                    self.assertEqual(conn.execute("SELECT COUNT(*) FROM effects WHERE effect_id='release:hold:o-17'").fetchone()[0], 1)
                    self.assertEqual(conn.execute("SELECT state FROM effects WHERE effect_id='hold:o-17'").fetchone()[0], "RELEASED")
                with sqlite3.connect(str(self.db_dir / "shipping.sqlite3")) as conn:
                    self.assertEqual(conn.execute("SELECT COUNT(*) FROM effects WHERE effect_id='shipping:o-17' AND state='CREATED'").fetchone()[0], 0)

    def test_reconciliation_does_not_cache_absence(self) -> None:
        from service import State
        state = State("payment", self.db_dir)
        try:
            query = command("o-17", "query-1", "payment:o-17", "payment_reconcile", amount=12000, currency="KRW")
            self.assertEqual(state.payment_reconcile(query)["status"], "NOT_FOUND")
            state.payment(dict(query, command_id="pay-1", kind="payment"))
            self.assertEqual(state.payment_reconcile(query)["status"], "AUTHORIZED")
            with self.assertRaises(ValueError):
                state.payment(dict(query, command_id="bad-1", effect_id="bad", kind="payment", amount=1.5))
        finally:
            state.conn.close()

    def test_terminal_workflow_does_not_restart_services(self) -> None:
        harness = ProcessHarness(self.db_dir)
        harness.start()
        try:
            self.assertEqual(run_flow(db_dir=self.db_dir)["final"], "COMPLETED")
        finally:
            harness.stop()
        self.assertEqual(run_flow(db_dir=self.db_dir), {"final": "COMPLETED", "resumed_terminal": True})

    def test_demo_success(self) -> None:
        result = subprocess.run([sys.executable, str(ROOT / "run_demo.py"), "--db-dir", str(self.db_dir)], cwd=str(ROOT), capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        parsed = json.loads(result.stdout)
        self.assertEqual(parsed["first"]["final"], "COMPLETED")
        self.assertEqual(parsed["second"]["final"], "COMPLETED")


if __name__ == "__main__":
    unittest.main()
