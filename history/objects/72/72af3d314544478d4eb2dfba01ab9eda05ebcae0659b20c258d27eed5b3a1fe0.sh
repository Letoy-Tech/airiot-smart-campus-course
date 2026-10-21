node tools/progress.mjs verify > ../evidence/stage-02/19-verify-after-repair.log 2>&1
print -r -- $? > ../evidence/stage-02/19-verify-after-repair.exit
