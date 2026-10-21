python3 ../tools/teacher-local-db.py init > ../evidence/stage-03/00-teacher-db-init.log 2>&1
print -r -- $? > ../evidence/stage-03/00-teacher-db-init.exit
