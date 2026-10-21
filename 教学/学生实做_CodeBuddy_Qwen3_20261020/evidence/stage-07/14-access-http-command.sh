python3 ../tools/acceptance-probe.py access --output evidence/stage-07/14-access-http.json > ../evidence/stage-07/14-access-http.log 2>&1
print -r -- $? > ../evidence/stage-07/14-access-http.exit
