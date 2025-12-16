"""
Deterministic Kafka Replay Bus for CU Digital Twin

Provides three operational modes for event streaming:
- live: Publish to real Kafka
- record: Publish to Kafka AND capture to file
- replay: Suppress live publishing, stream from recorded file

This enables:
- Replayable event streams for debugging and testing
- Deterministic CU runs for policy diff testing
- Commit-level event capture for audit trails
- Zero-drift simulation replay across environments

Usage:
    # Record mode (capture events while running live)
    $ REPLAY_MODE=record REPLAY_FILE=replays/run-001.jsonl python -m cli steady-state
    
    # Replay mode (deterministic playback from file)
    $ REPLAY_MODE=replay REPLAY_FILE=replays/run-001.jsonl python -m cli steady-state
    
    # Live mode (default, no recording)
    $ python -m cli steady-state
"""

import json
import os
from typing import Dict, Any, Callable, Optional
from pathlib import Path


# Environment configuration
REPLAY_MODE = os.getenv("REPLAY_MODE", "live")  # live | record | replay
REPLAY_FILE = os.getenv("REPLAY_FILE", "replays/cu_replay.jsonl")


def publish(event: Dict[str, Any], live_publisher: Callable[[Dict[str, Any]], None]) -> None:
    """
    Universal publish entry point with mode-aware behavior.
    
    Modes:
    - live: Publish to Kafka only
    - record: Publish to Kafka AND write to file
    - replay: Suppress live publish (events come from replay() instead)
    
    Args:
        event: Event dictionary to publish
        live_publisher: Function that publishes to live Kafka
    """
    if REPLAY_MODE == "replay":
        # During replay, suppress live publishing
        return
    
    if REPLAY_MODE in ("live", "record"):
        # Publish to live Kafka
        live_publisher(event)
    
    if REPLAY_MODE == "record":
        # Also capture to file for future replay
        _record_event(event)


def replay(handler: Callable[[Dict[str, Any]], None]) -> None:
    """
    Replay events from recorded file in deterministic order.
    
    Only executes when REPLAY_MODE=replay. Reads events from REPLAY_FILE
    and passes each to the provided handler function.
    
    Args:
        handler: Function to process each replayed event
        
    Raises:
        FileNotFoundError: If replay file doesn't exist in replay mode
    """
    if REPLAY_MODE != "replay":
        return
    
    replay_path = Path(REPLAY_FILE)
    if not replay_path.exists():
        raise FileNotFoundError(
            f"Replay file not found: {REPLAY_FILE}\n"
            f"Record a run first with: REPLAY_MODE=record"
        )
    
    print(f"[REPLAY] Loading events from {REPLAY_FILE}")
    event_count = 0
    
    with open(replay_path, "r") as f:
        for line in f:
            event = json.loads(line)
            handler(event)
            event_count += 1
    
    print(f"[REPLAY] Replayed {event_count} events")


def _record_event(event: Dict[str, Any]) -> None:
    """
    Internal: Record event to file for future replay.
    
    Args:
        event: Event dictionary to record
    """
    replay_path = Path(REPLAY_FILE)
    replay_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(replay_path, "a") as f:
        f.write(json.dumps(event) + "\n")


def get_mode() -> str:
    """
    Get current replay mode.
    
    Returns:
        Current mode: 'live', 'record', or 'replay'
    """
    return REPLAY_MODE


def get_replay_file() -> str:
    """
    Get current replay file path.
    
    Returns:
        Path to replay file
    """
    return REPLAY_FILE


def clear_replay_file() -> None:
    """
    Clear the replay file to start fresh recording.
    
    Useful when starting a new recording session.
    """
    replay_path = Path(REPLAY_FILE)
    if replay_path.exists():
        replay_path.unlink()
        print(f"[REPLAY] Cleared {REPLAY_FILE}")


if __name__ == "__main__":
    # Demo usage
    print(f"Replay Bus Configuration:")
    print(f"  Mode: {get_mode()}")
    print(f"  File: {get_replay_file()}")
    print()
    
    # Example: Recording events
    def mock_kafka_publish(event):
        print(f"[KAFKA] Published: {event}")
    
    # Simulate publishing events
    if REPLAY_MODE == "record":
        print("Recording mode - events will be captured to file")
        for i in range(3):
            event = {"type": "transaction", "id": i, "amount": 100.0 * (i + 1)}
            publish(event, mock_kafka_publish)
    
    # Example: Replaying events
    if REPLAY_MODE == "replay":
        print("Replay mode - loading events from file")
        def mock_handler(event):
            print(f"[HANDLER] Processed: {event}")
        
        replay(mock_handler)
