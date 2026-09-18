"""Bounded child supervision; NOT_RUN is distinct from integration PASS."""
import platform
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parent


def stop(process):
    if process.poll() is None:
        process.send_signal(signal.SIGTERM)
    try:
        return process.wait(timeout=4)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=2)
        raise RuntimeError("server did not drain before the wrapper deadline")


def run(name, port):
    log_path = ROOT / (name + ".log")
    with log_path.open("w") as log:
        process = subprocess.Popen([str(ROOT / name)], cwd=ROOT, stdout=log, stderr=log)
        try:
            deadline = time.monotonic() + 4
            while "listening on 127.0.0.1:" not in log_path.read_text():
                code = process.poll()
                if code == 77:
                    print("NOT_RUN: io_uring setup unavailable; see " + log_path.name)
                    return False
                if code is not None:
                    raise RuntimeError(f"{name} exited during startup: {code}")
                if time.monotonic() >= deadline:
                    raise TimeoutError(name + " startup")
                time.sleep(0.025)
            for mode in [("whole",), ("split",), ("split", "halfclose"), ("backpressure",)]:
                subprocess.run([str(ROOT / "test_client"), str(port), *mode], check=True, timeout=8)
            # A fresh connection checks continued service after the slow-reader probe.
            subprocess.run([str(ROOT / "test_client"), str(port), "whole"], check=True, timeout=8)
            code = stop(process)
            if code != 0:
                raise RuntimeError(f"{name} shutdown exit {code}; see {log_path.name}")
            print(f"PASS {name}: whole/split/half-close, slow-reader probe, bounded shutdown")
            return True
        finally:
            if process.poll() is None:
                stop(process)


if __name__ == "__main__":
    if platform.system() != "Linux":
        print("NOT_RUN: Linux epoll/liburing compilation and integration require Linux")
    else:
        subprocess.run(["make", "all"], cwd=ROOT, check=True, timeout=120)
        run("epoll_echo", 19090)
        run("uring_echo", 19091)
