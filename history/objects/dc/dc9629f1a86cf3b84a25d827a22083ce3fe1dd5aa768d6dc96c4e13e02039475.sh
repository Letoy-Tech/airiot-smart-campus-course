export PATH="/Users/learner/.nvm/versions/node/v22.21.1/bin:$PATH"
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
mkdir -p ../evidence/stage-01
node --version > ../evidence/stage-01/node-version.txt
java -version > ../evidence/stage-01/java-version.txt 2>&1
node -p "process.cwd()" > ../evidence/stage-01/cwd.txt
