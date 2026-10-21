node tools/course.mjs migrate > ../evidence/stage-03/03-teacher-migrate.log 2>&1
print -r -- $? > ../evidence/stage-03/03-teacher-migrate.exit
