python3 ../tools/acceptance-probe.py close-no-note --case-id f09aaa5d-faa4-48cd-b863-91213e6ea562 --output evidence/stage-09/17-no-note-http.json > ../evidence/stage-09/17-no-note-http.log 2>&1
print -r -- $? > ../evidence/stage-09/17-no-note-http.exit
