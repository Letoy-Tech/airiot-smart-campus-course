node tools/progress.mjs plan 09 > ../evidence/stage-09/01-plan.log 2>&1
node tools/progress.mjs begin 09 > ../evidence/stage-09/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-09/02-begin.exit
