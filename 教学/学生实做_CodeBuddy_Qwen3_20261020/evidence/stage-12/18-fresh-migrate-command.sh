(cd ../handoff-run/app && node tools/course.mjs migrate) > ../evidence/stage-12/18-fresh-migrate.log 2>&1
print -r -- $? > ../evidence/stage-12/18-fresh-migrate.exit
