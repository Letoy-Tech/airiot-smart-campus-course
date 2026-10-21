python3 ../tools/acceptance-probe.py locations --output evidence/stage-04/12-negative-http.json > ../evidence/stage-04/12-negative-http.log 2>&1
print -r -- $? > ../evidence/stage-04/12-negative-http.exit
