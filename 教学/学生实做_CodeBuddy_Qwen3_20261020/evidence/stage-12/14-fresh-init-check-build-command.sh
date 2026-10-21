(cd ../handoff-run/app && node tools/course.mjs init) > ../evidence/stage-12/14-fresh-account-init.log 2>&1
print -r -- $? > ../evidence/stage-12/14-fresh-account-init.exit
(cd ../handoff-run/app && node tools/course.mjs check) > ../evidence/stage-12/15-fresh-check.log 2>&1
print -r -- $? > ../evidence/stage-12/15-fresh-check.exit
(cd ../handoff-run/app && node tools/course.mjs build) > ../evidence/stage-12/16-fresh-build.log 2>&1
print -r -- $? > ../evidence/stage-12/16-fresh-build.exit
