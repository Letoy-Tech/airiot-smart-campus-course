node tools/progress.mjs verify > ../evidence/stage-03/09-verify.log 2>&1
print -r -- $? > ../evidence/stage-03/09-verify.exit
