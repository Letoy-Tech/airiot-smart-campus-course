python3 ../tools/acceptance-probe.py owner-snapshots --case-id 8fda017a-c8d1-443d-9cbc-90e9f39c1655 --other-case-id 1f5cdc11-c79c-45d7-b2f8-93d2d44714ff --expected-owner manager-a --expected-version 3 --output evidence/stage-10/22-owner-no-replay-http.json > ../evidence/stage-10/22-owner-no-replay-http.log 2>&1
print -r -- $? > ../evidence/stage-10/22-owner-no-replay-http.exit
