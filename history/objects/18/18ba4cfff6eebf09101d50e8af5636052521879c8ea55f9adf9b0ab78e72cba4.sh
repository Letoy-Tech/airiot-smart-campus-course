export PATH="$JAVA_HOME/bin:$PATH"
java -version > ../evidence/stage-01/java-version-corrected.txt 2>&1
node tools/progress.mjs plan 01 > ../evidence/stage-01/01-plan.log 2>&1
node tools/progress.mjs begin 01 > ../evidence/stage-01/02-begin.log 2>&1
npm --prefix frontend ci > ../evidence/stage-01/03-npm-ci.log 2>&1
