#!/usr/bin/env python3
"""Run portable knowledge-lab checks without pretending to run platform integration."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
LABS = ROOT / "examples/knowledge"


def run(command, cwd=ROOT):
    print("RUN", " ".join(map(str, command)), flush=True)
    subprocess.run(list(map(str, command)), cwd=cwd, check=True, timeout=60)


def main():
    for name, script in [("pathfinding-lab", "pathfinding_lab.py"),
                         ("sorting-lab", "sorting_lab.py"),
                         ("os-foundations-lab", "scheduler_lab.py")]:
        run([sys.executable, LABS / name / script, "--test"])
    run([sys.executable, LABS / "recast-voxel-lab/voxel_reference.py"])
    for args in [[], ["--safe"]]:
        run([sys.executable, LABS / "python-runtime-lab/compound_state.py", *args])
    run([sys.executable, "-m", "unittest", "discover", "-s", LABS / "msa-lab", "-p", "test_lab.py", "-v"])
    run([sys.executable, "-m", "unittest", "discover", "-s", LABS / "kafka-lab/tests", "-p", "test_*.py", "-v"])
    run(["node", "--test", "test/lab.test.mjs"], LABS / "dns-balancing-lab")
    # Uses the explicitly installed, lockfile-pinned local jose dependency.
    if (LABS / "auth-protocol-lab/node_modules/jose").exists():
        run(["node", "--test", "test/lab.test.mjs"], LABS / "auth-protocol-lab")
    else:
        print("NOT_RUN auth runtime: npm ci --ignore-scripts in auth-protocol-lab first")
    print("PASS portable models and local saga checks")
    print("NOT_RUN by this runner: native C++/Java/Swift builds, browser, Linux/Windows APIs, broker containers, free-threaded CPython")


if __name__ == "__main__":
    main()
