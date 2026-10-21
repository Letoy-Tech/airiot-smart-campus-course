python3 ../tools/record-source.py snapshot stage-11/after-regression-repairs
python3 ../tools/record-source.py diff stage-11/before-regression-repairs stage-11/after-regression-repairs stage-11/regression-repairs.diff
node tools/progress.mjs accept 11 evidence/stage-11.md > ../evidence/stage-11/30-accept.log 2>&1
print -r -- $? > ../evidence/stage-11/30-accept.exit
