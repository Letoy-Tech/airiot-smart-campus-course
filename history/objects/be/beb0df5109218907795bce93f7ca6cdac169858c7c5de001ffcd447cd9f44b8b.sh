python3 ../tools/record-source.py snapshot stage-12/after-model
python3 ../tools/record-source.py diff stage-12/after-begin stage-12/after-model stage-12/model-delivery.diff
node tools/progress.mjs verify > ../evidence/stage-12/31-final-verify.log 2>&1
print -r -- $? > ../evidence/stage-12/31-final-verify.exit
