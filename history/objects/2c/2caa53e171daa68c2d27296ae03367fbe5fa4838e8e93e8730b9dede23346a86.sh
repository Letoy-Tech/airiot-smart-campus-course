node tools/progress.mjs accept 01 evidence/stage-01.md > ../evidence/stage-01/09-accept.log 2>&1
print -r -- $? > ../evidence/stage-01/09-accept.exit
