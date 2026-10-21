node tools/progress.mjs plan 06 > ../evidence/stage-06/01-plan.log 2>&1
node tools/progress.mjs begin 06 > ../evidence/stage-06/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-06/02-begin.exit
