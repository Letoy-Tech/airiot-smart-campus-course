node tools/progress.mjs plan 02 > ../evidence/stage-02/01-plan.log 2>&1
node tools/progress.mjs begin 02 > ../evidence/stage-02/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-02/02-begin.exit
