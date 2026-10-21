export PATH="/Users/learner/.nvm/versions/node/v22.21.1/bin:$PATH"
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export PATH="$JAVA_HOME/bin:$PATH"
node tools/progress.mjs verify > ../evidence/stage-01/08-verify.log 2>&1
print -r -- $? > ../evidence/stage-01/08-verify.exit
