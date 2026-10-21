python3 ../tools/acceptance-probe.py case-permissions --case-id 5bd33750-0afd-475d-8c99-c97b42f7429f --output evidence/stage-08/15-permission-http.json > ../evidence/stage-08/15-permission-http.log 2>&1
print -r -- $? > ../evidence/stage-08/15-permission-http.exit
