python3 ../tools/acceptance-probe.py close-unverified --case-id 5bd33750-0afd-475d-8c99-c97b42f7429f --output evidence/stage-09/10-unverified-http.json > ../evidence/stage-09/10-unverified-http.log 2>&1
print -r -- $? > ../evidence/stage-09/10-unverified-http.exit
