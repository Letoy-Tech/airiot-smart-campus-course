npm --prefix frontend run test:unit -- --run src/tests/http.test.ts > ../evidence/stage-11/06-http-intentional-failure.log 2>&1
print -r -- $? > ../evidence/stage-11/06-http-intentional-failure.exit
