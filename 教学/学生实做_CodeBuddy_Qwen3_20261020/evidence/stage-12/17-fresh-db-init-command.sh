(cd ../handoff-run/app && python3 ../tools/teacher-local-db.py init) > ../evidence/stage-12/17-fresh-db-init.log 2>&1
print -r -- $? > ../evidence/stage-12/17-fresh-db-init.exit
