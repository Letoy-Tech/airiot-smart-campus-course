node tools/progress.mjs plan 05 > ../evidence/stage-05/01-plan.log 2>&1
node tools/progress.mjs begin 05 > ../evidence/stage-05/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-05/02-begin.exit
