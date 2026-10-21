npm --prefix frontend run test:unit -- --run src/tests/case-trigger-race.test.ts src/tests/workflow-views.test.ts > ../evidence/stage-11/17-workflow-operator-verify.log 2>&1
print -r -- $? > ../evidence/stage-11/17-workflow-operator-verify.exit
