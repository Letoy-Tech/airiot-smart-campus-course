node tools/course.mjs build > ../evidence/stage-11/27-final-build.log 2>&1
print -r -- $? > ../evidence/stage-11/27-final-build.exit
node tools/progress.mjs verify > ../evidence/stage-11/28-final-verify.log 2>&1
print -r -- $? > ../evidence/stage-11/28-final-verify.exit
