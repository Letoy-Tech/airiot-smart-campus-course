npm --prefix frontend run test:unit -- --run src/tests/http.test.ts > ../evidence/stage-11/08-http-fault-confirmed.log 2>&1
print -r -- $? > ../evidence/stage-11/08-http-fault-confirmed.exit
