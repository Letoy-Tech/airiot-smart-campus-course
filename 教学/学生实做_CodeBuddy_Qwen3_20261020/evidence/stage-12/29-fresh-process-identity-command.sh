lsof -nP -iTCP:8091 -iTCP:5178 -iTCP:23491 -sTCP:LISTEN > ../evidence/stage-12/29-fresh-process-identity.log 2>&1
for course_handoff_pid in $(lsof -t -iTCP:8091 -iTCP:5178 -iTCP:23491 -sTCP:LISTEN); do lsof -a -p "$course_handoff_pid" -dcwd -Fn >> ../evidence/stage-12/29-fresh-process-identity.log 2>&1; done
