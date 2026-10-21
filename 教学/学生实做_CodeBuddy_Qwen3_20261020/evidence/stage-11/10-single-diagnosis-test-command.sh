npm --prefix frontend run test:unit -- --run src/tests/http.test.ts -t '成功空数组仍保留后端观察时间' > ../evidence/stage-11/10-single-diagnosis-test.log 2>&1
print -r -- $? > ../evidence/stage-11/10-single-diagnosis-test.exit
