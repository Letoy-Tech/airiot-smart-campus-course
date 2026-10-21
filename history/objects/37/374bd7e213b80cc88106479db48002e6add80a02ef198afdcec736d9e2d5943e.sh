node tools/progress.mjs verify > ../evidence/stage-04/07-verify.log 2>&1
print -r -- $? > ../evidence/stage-04/07-verify.exit
