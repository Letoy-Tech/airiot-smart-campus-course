node tools/course.mjs init > ../evidence/stage-02/03-init.log 2>&1
print -r -- $? > ../evidence/stage-02/03-init.exit
node tools/course.mjs build > ../evidence/stage-02/04-course-build.log 2>&1
print -r -- $? > ../evidence/stage-02/04-course-build.exit
