python3 ../tools/teacher-local-db.py stop > ../evidence/stage-12/04-original-db-stop.log 2>&1
print -r -- $? > ../evidence/stage-12/04-original-db-stop.exit
lsof -nP -iTCP:8091 -iTCP:5178 -iTCP:23491 -sTCP:LISTEN > ../evidence/stage-12/04-ports-after-original-stop.log 2>&1
