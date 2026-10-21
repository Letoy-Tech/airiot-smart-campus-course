node tools/progress.mjs plan 08 > ../evidence/stage-08/01-plan.log 2>&1
node tools/progress.mjs begin 08 > ../evidence/stage-08/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-08/02-begin.exit
