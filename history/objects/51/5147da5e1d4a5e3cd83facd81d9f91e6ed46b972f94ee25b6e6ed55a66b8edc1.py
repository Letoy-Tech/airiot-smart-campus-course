"""Keep only this active trial's owned browser session alive during IDE waits.

Read-only observation; no UI actions, capture output, credentials, or recovery.
Create process/keepalive.stop to stop. Exits on session failure or after 8 hours.
"""
from pathlib import Path
import datetime, os, subprocess, sys, time

base = Path(__file__).resolve().parent
session = sys.argv[1]
env = dict(os.environ, BSK_AUTO_START='0')
for _ in range(480):
    if (base / 'keepalive.stop').exists():
        break
    try:
        result = subprocess.run(
            ['/Users/learner/.local/bin/bsk', 'observe', '--session', session],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env=env, timeout=25,
        )
    except subprocess.TimeoutExpired:
        print('Observation timeout; stopping without retry or recovery.', flush=True)
        break
    if result.returncode:
        print('Session observation failed; stopping without recovery.', flush=True)
        break
    print(datetime.datetime.now().isoformat(), 'owned session active', flush=True)
    for _ in range(12):
        if (base / 'keepalive.stop').exists():
            break
        time.sleep(5)
