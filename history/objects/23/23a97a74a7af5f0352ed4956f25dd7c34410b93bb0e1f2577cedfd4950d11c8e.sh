python3 ../tools/record-source.py snapshot stage-12/before-begin
node tools/progress.mjs plan 12 > ../evidence/stage-12/01-plan.log 2>&1
node tools/progress.mjs begin 12 > ../evidence/stage-12/02-begin.log 2>&1
print -r -- $? > ../evidence/stage-12/02-begin.exit
python3 ../tools/record-source.py snapshot stage-12/after-begin
