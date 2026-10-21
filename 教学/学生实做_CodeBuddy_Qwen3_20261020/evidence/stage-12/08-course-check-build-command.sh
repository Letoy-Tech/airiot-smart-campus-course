node tools/course.mjs check > ../evidence/stage-12/08-course-check.log 2>&1
print -r -- $? > ../evidence/stage-12/08-course-check.exit
node tools/course.mjs build > ../evidence/stage-12/09-course-build.log 2>&1
print -r -- $? > ../evidence/stage-12/09-course-build.exit
