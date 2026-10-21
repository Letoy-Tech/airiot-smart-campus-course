node tools/progress.mjs plan 03 > ../evidence/stage-03/01-plan.log 2>&1
node tools/progress.mjs begin 03 > ../evidence/stage-03/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-03/02-begin.exit
