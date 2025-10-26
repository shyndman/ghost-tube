#!/usr/bin/env -S uv run --script
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["paho-mqtt>=2.1"]
# ///
"""

import argparse
import json
import sys
import time
from typing import Sequence

from paho.mqtt.client import Client, MQTTMessageInfo


def build_payload(video_id: str, as_json: bool) -> str:
    if as_json:
        return json.dumps({"media_content_id": video_id})
    return video_id


def publish_playmedia(
    broker: str,
    port: int,
    device: str,
    video_id: str,
    *,
    username: str | None,
    password: str | None,
    retain: bool,
    qos: int,
    use_json: bool,
    transport: str,
    path: str,
    timeout: float,
) -> int:
    topic = f"ghost-tube/media_player/{device}/playmedia"
    payload = build_payload(video_id, use_json)

    client = Client(transport=transport)
    if transport == "websockets":
        client.ws_set_options(path=path)

    if username:
        client.username_pw_set(username=username, password=password)

    print(f"Connecting to {broker}:{port} via {transport}…", flush=True)
    try:
        client.connect(broker, port=port, keepalive=20)
    except Exception as exc:  # noqa: BLE001
        print(f"Connection failed: {exc}", file=sys.stderr)
        return 1

    client.loop_start()

    print(f"Publishing to {topic} (qos={qos}, retain={retain})…", flush=True)
    info: MQTTMessageInfo = client.publish(topic, payload, qos=qos, retain=retain)

    deadline = time.monotonic() + timeout
    while not info.is_published():
        if time.monotonic() > deadline:
            print("Publish timed out.", file=sys.stderr)
            client.loop_stop()
            client.disconnect()
            return 2
        time.sleep(0.1)

    print("Publish acknowledged.")
    client.loop_stop()
    client.disconnect()
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send a playmedia MQTT command to GhostTube",
    )
    parser.add_argument(
        "device", help="Configured MQTT device name, e.g. living-room-tv"
    )
    parser.add_argument("video_id", help="YouTube video ID to play")
    parser.add_argument("--broker", default="192.168.86.29", help="MQTT broker host")
    parser.add_argument("--port", type=int, default=8083, help="MQTT broker port")
    parser.add_argument(
        "--username",
        help="Optional username for the broker",
    )
    parser.add_argument(
        "--password",
        help="Optional password for the broker",
    )
    parser.add_argument(
        "--retain",
        action="store_true",
        help="Retain the playmedia command on the broker",
    )
    parser.add_argument(
        "--qos",
        type=int,
        default=1,
        choices=(0, 1, 2),
        help="Quality of service level",
    )
    parser.add_argument(
        "--plain",
        dest="use_json",
        action="store_false",
        help="Send the raw video ID instead of JSON payload",
    )
    parser.add_argument(
        "--transport",
        choices=("tcp", "websockets"),
        default="websockets",
        help="MQTT transport protocol",
    )
    parser.add_argument(
        "--ws-path",
        default="/",
        help="Websocket path when using websockets transport",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=5.0,
        help="Seconds to wait for publish acknowledgement",
    )

    parser.set_defaults(use_json=True)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    return publish_playmedia(
        broker=args.broker,
        port=args.port,
        device=args.device,
        video_id=args.video_id,
        username=args.username,
        password=args.password,
        retain=args.retain,
        qos=args.qos,
        use_json=args.use_json,
        transport=args.transport,
        path=args.ws_path,
        timeout=args.timeout,
    )


if __name__ == "__main__":
    raise SystemExit(main())
