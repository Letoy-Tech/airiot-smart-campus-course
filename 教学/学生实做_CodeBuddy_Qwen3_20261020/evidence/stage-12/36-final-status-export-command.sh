node tools/progress.mjs status > ../evidence/stage-12/36-final-status.log 2>&1
print -r -- $? > ../evidence/stage-12/36-final-status.exit
node tools/hand-in.mjs > ../evidence/stage-12/37-final-hand-in.log 2>&1
print -r -- $? > ../evidence/stage-12/37-final-hand-in.exit
