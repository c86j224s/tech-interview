"""Disposable local topology; separate observed assertions from untested recovery."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
RUN = uuid.uuid4().hex[:10]
COMPOSE = ["docker", "compose", "-p", "pulsar-lab-" + RUN, "-f", str(ROOT / "docker-compose.multinode.yml")]
TOPIC = "persistent://public/default/orders-" + RUN
SUB = "orders-shared"
children = []
logs = []


def command(args, timeout=90, **kwargs):
    return subprocess.run(args, cwd=ROOT, text=True, check=True, timeout=timeout, **kwargs)


def admin(broker, *args):
    return command(COMPOSE + ["exec", "-T", broker, "bin/pulsar-admin", *args], capture_output=True).stdout


def until(predicate, seconds, description):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(0.1)
    raise TimeoutError(description)


def stop(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=4)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=2)


def main():
    for tool in ("docker", "mvn", "java"):
        if not shutil.which(tool):
            print("NOT_RUN: missing " + tool)
            return
    out = ROOT / "var" / RUN
    out.mkdir(parents=True)
    command(["mvn", "-q", "test", "package", "dependency:build-classpath", "-Dmdep.outputFile=target/classpath.txt"], timeout=180)
    cp = str(ROOT / "target/classes") + os.pathsep + (ROOT / "target/classpath.txt").read_text().strip()
    base = ["java", "-cp", cp, "com.example.pulsarlab.App"]
    env = dict(os.environ, PULSAR_LISTENER_NAME="external", PULSAR_INBOX_LEDGER=str(out / "shared.ledger"), PULSAR_CONSUMER_SECONDS="120")
    def start(name, url, delay="0"):
        path = out / (name + ".log")
        stream = path.open("w")
        logs.append(stream)
        process = subprocess.Popen(base + ["consumer", url, TOPIC, SUB, "Shared"], cwd=ROOT,
                                   env=dict(env, PULSAR_ACK_DELAY_MS=delay), stdout=stream, stderr=stream)
        children.append(process)
        def ready():
            if process.poll() is not None:
                raise RuntimeError(name + " exited before READY")
            return "READY subscription=" in path.read_text()
        until(ready, 20, name + " readiness")
        return process, path
    def produce(url, count):
        return command(base + ["producer", url, TOPIC, "false", str(count)], env=env, capture_output=True).stdout
    def lookup(broker):
        return admin(broker, "topics", "lookup", TOPIC + "-partition-0").strip().strip('"')
    command(COMPOSE + ["config", "--quiet"])
    try:
        command(COMPOSE + ["up", "-d", "--wait", "--wait-timeout", "150"], timeout=180)
        # Fresh project volumes: initialization creates public tenant, then explicit namespace check.
        tenants = json.loads(admin("broker-1", "tenants", "list"))
        if "public" not in tenants:
            admin("broker-1", "tenants", "create", "public", "--allowed-clusters", "local-cluster")
        namespaces = json.loads(admin("broker-1", "namespaces", "list", "public"))
        if "public/default" not in namespaces:
            admin("broker-1", "namespaces", "create", "public/default", "--clusters", "local-cluster")
        admin("broker-1", "topics", "create-partitioned-topic", TOPIC, "--partitions", "1")
        first, first_log = start("worker-a", "pulsar://127.0.0.1:6650", "10000")
        produced = produce("pulsar://127.0.0.1:6650", 1)
        event = re.search(r"SEND eventId=(\S+)", produced).group(1)
        until(lambda: f"COMMIT eventId={event} " in first_log.read_text(), 15, "pre-ACK commit")
        first.kill()
        first.wait(timeout=3)
        if f"ACK eventId={event} " in first_log.read_text():
            raise AssertionError("failure injection missed the pre-ACK window")
        second, second_log = start("worker-b", "pulsar://127.0.0.1:6650")
        until(lambda: f"ACK eventId={event} applied=false " in second_log.read_text(), 40, "redelivery deduplication")
        print("PASS worker restart: same event redelivered, durable effect not repeated")
        owner = lookup("broker-1")
        if "broker-1:6650" in owner:
            failed, survivor, host = "broker-1", "broker-2", "6651"
        elif "broker-2:6650" in owner:
            failed, survivor, host = "broker-2", "broker-1", "6650"
        else:
            raise AssertionError("unrecognized internal owner: " + owner)
        stop(second)
        command(COMPOSE + ["stop", failed])
        def reassigned():
            try:
                return survivor + ":6650" in lookup(survivor)
            except subprocess.CalledProcessError:
                return False
        until(reassigned, 40, "partition owner reassignment")
        third, third_log = start("survivor", "pulsar://127.0.0.1:" + host)
        produced = produce("pulsar://127.0.0.1:" + host, 3)
        ids = re.findall(r"SEND eventId=(\S+)", produced)
        if len(ids) != 3:
            raise AssertionError("sentinel producer count")
        until(lambda: all(f"ACK eventId={eid} " in third_log.read_text() for eid in ids), 30, "sentinel ACKs")
        print("PASS broker failover: owner changed and three sentinel IDs were acknowledged")
        stop(third)
        command(COMPOSE + ["start", failed])
        command(COMPOSE + ["stop", "bookie-1"])
        (out / "bookie-loss-topology.txt").write_text(command(COMPOSE + ["ps"], capture_output=True).stdout)
        print("OBSERVED bookie-1 stop only; under-replication/readability/re-replication NOT_VERIFIED (E3/W3, no spare)")
        command(COMPOSE + ["start", "bookie-1"])
        print("NOT_VERIFIED: retry/DLQ wire behavior, Key_Shared ordering, recovered bookie data")
    finally:
        for process in children:
            stop(process)
        for stream in logs:
            stream.close()
        # Only this randomly named disposable project's resources are removed.
        command(COMPOSE + ["down", "--volumes", "--remove-orphans"], timeout=90)


if __name__ == "__main__":
    main()
