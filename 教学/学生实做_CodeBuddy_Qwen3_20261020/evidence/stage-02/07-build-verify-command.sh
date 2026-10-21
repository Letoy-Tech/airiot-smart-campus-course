node tools/course.mjs build > ../evidence/stage-02/07-course-build-after-model.log 2>&1
print -r -- $? > ../evidence/stage-02/07-course-build-after-model.exit
node tools/progress.mjs verify > ../evidence/stage-02/08-verify.log 2>&1
print -r -- $? > ../evidence/stage-02/08-verify.exit
