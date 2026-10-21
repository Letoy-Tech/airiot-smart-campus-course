node tools/progress.mjs plan 11 > ../evidence/stage-11/01-plan.log 2>&1
node tools/progress.mjs begin 11 > ../evidence/stage-11/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-11/02-begin.exit
