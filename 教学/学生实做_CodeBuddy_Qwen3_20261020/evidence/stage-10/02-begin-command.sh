node tools/progress.mjs plan 10 > ../evidence/stage-10/01-plan.log 2>&1
node tools/progress.mjs begin 10 > ../evidence/stage-10/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-10/02-begin.exit
