python3 ../tools/teacher-local-db.py use-runtime > ../evidence/stage-03/05-runtime-config.log 2>&1
print -r -- $? > ../evidence/stage-03/05-runtime-config.exit
