(cd ../handoff-run/app && python3 ../tools/teacher-local-db.py use-runtime) > ../evidence/stage-12/19-fresh-runtime-config.log 2>&1
print -r -- $? > ../evidence/stage-12/19-fresh-runtime-config.exit
