(cd backend && node tools/test-mysql.mjs package) > ../evidence/stage-11/14-mysql-full.log 2>&1
print -r -- $? > ../evidence/stage-11/14-mysql-full.exit
