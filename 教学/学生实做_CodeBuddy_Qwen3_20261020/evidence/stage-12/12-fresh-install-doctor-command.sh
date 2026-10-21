(cd ../handoff-run/app && npm --prefix frontend ci) > ../evidence/stage-12/12-fresh-install.log 2>&1
print -r -- $? > ../evidence/stage-12/12-fresh-install.exit
(cd ../handoff-run/app && node tools/course.mjs doctor) > ../evidence/stage-12/13-fresh-doctor.log 2>&1
print -r -- $? > ../evidence/stage-12/13-fresh-doctor.exit
