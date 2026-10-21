(cd ../handoff-run/app && python3 ../tools/teacher-local-db.py stop) > ../evidence/stage-12/30-fresh-db-stop.log 2>&1
print -r -- $? > ../evidence/stage-12/30-fresh-db-stop.exit
lsof -nP -iTCP:8091 -iTCP:5178 -iTCP:23491 -sTCP:LISTEN > ../evidence/stage-12/30-final-port-listeners.log 2>&1
