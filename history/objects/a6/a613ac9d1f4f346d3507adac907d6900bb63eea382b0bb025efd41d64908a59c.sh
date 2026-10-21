node tools/progress.mjs plan 07 > ../evidence/stage-07/01-plan.log 2>&1
node tools/progress.mjs begin 07 > ../evidence/stage-07/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-07/02-begin.exit
