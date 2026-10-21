node tools/progress.mjs verify > ../evidence/stage-05/12-verify.log 2>&1
print -r -- $? > ../evidence/stage-05/12-verify.exit
