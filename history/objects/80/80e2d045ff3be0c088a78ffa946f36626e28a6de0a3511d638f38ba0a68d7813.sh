node tools/progress.mjs plan 04 > ../evidence/stage-04/01-plan.log 2>&1
node tools/progress.mjs begin 04 > ../evidence/stage-04/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-04/02-begin.exit
