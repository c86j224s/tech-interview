from __future__ import annotations

import argparse
import json
import signal
import subprocess
import sys
from pathlib import Path

from coordinator import SERVICES, run_flow, wait


ROOT = Path(__file__).resolve().parent


def start_services(db_dir: Path, failpoint: str = ""):
    processes = []
    for service, port in SERVICES.items():
        target_failpoint = failpoint if (service == "payment" or service == "shipping") else ""
        if service == "payment" and failpoint.startswith("shipping-permanent-failure"):
            target_failpoint = failpoint.split(",", 1)[1] if "," in failpoint else ""
        if service == "shipping" and failpoint.startswith("shipping-permanent-failure"):
            target_failpoint = "shipping-permanent-failure"
        processes.append(subprocess.Popen([sys.executable, str(ROOT / "service.py"), "--service", service, "--port", str(port), "--db-dir", str(db_dir), "--failpoint", target_failpoint], cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    try:
        for service in SERVICES:
            wait(service)
        if any(process.poll() is not None for process in processes):
            raise RuntimeError("a child exited during startup; check port conflicts")
        return processes
    except Exception:
        stop_services(processes)
        raise


def stop_services(processes) -> None:
    for process in processes:
        if process.poll() is None:
            process.send_signal(signal.SIGTERM)
    for process in processes:
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=2)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-dir", type=Path, default=Path(".msa-lab-data"))
    parser.add_argument("--failpoint", default="")
    parser.add_argument("--reconcile-restart", action="store_true")
    args = parser.parse_args()
    db_dir = args.db_dir.resolve()
    db_dir.mkdir(parents=True, exist_ok=True)
    processes = []
    try:
        processes = start_services(db_dir, args.failpoint)
        first = run_flow(db_dir=db_dir)
        if args.reconcile_restart and (args.failpoint.startswith("payment-") or args.failpoint.startswith("refund-") or args.failpoint.startswith("shipping-permanent-failure")):
            stop_services(processes)
            processes = start_services(db_dir)
            second = run_flow(reconcile_unknown=True, db_dir=db_dir, resume_compensation=True)
        else:
            second = run_flow(db_dir=db_dir)
        print(json.dumps({"first": first, "second": second, "failpoint": args.failpoint, "restarted": bool(args.reconcile_restart)}, sort_keys=True, indent=2))
        if args.failpoint == "" and (first["final"] != "COMPLETED" or second["final"] != "COMPLETED"):
            raise AssertionError((first, second))
        if args.reconcile_restart and (args.failpoint.startswith("payment-") or args.failpoint.startswith("refund-") or args.failpoint.startswith("shipping-permanent-failure")):
            expected_final = "CANCELLED" if args.failpoint.startswith("shipping-permanent-failure") else "COMPLETED"
            if second["final"] != expected_final:
                raise AssertionError(second)
            with __import__("sqlite3").connect(str(db_dir / "payment.sqlite3")) as conn:
                assert conn.execute("SELECT COUNT(*) FROM provider_ledger WHERE provider_key='payment:o-17'").fetchone()[0] == 1
                assert conn.execute("SELECT COUNT(*) FROM effects WHERE effect_id='payment:o-17'").fetchone()[0] == 1
            with __import__("sqlite3").connect(str(db_dir / "shipping.sqlite3")) as conn:
                assert conn.execute("SELECT COUNT(*) FROM effects WHERE effect_id='shipping:o-17'").fetchone()[0] == 1
    finally:
        stop_services(processes)


if __name__ == "__main__":
    main()
