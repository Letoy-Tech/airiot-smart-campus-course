node tools/progress.mjs verify > ../evidence/stage-11/12-full-frontend-verify.log 2>&1
print -r -- $? > ../evidence/stage-11/12-full-frontend-verify.exit
