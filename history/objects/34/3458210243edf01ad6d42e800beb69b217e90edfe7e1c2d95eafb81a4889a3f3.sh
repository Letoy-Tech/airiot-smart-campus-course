export PATH="/Users/learner/.nvm/versions/node/v22.21.1/bin:$PATH"
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export PATH="$JAVA_HOME/bin:$PATH"
node tools/course.mjs frontend > ../evidence/stage-02/10-frontend.log 2>&1
