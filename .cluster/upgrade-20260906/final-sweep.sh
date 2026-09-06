#!/bin/bash
# 终态全量回归：28 项目 × (typecheck / lint / test)
cd /d/multi-agent
OUT=/d/multi-agent/.cluster/upgrade-20260906/final-sweep.txt
> "$OUT"
PROJECTS="binding-price bqp-map burial-record causal-ineq choice-lang depreciation-ledger dsic-noether ent-clearing ent-sched ft-qaoa k-switch letter-audit mutant-census nonstoq-anneal nosignal-tariff postselect-sched qram-sched quantum-mech qverify readout-wall retro-cache route-price stable-world survivor-census switch-sched vacuum-compiler wukong-crossval"
for d in $PROJECTS ds_extracted/ds; do
  cd "/d/multi-agent/$d" || continue
  tc="NO_SCRIPT"; li="NO_SCRIPT"; tt="FAIL"
  if grep -q '"typecheck"' package.json 2>/dev/null; then
    npm run -s typecheck > /tmp/fs-tc.log 2>&1 && tc="PASS" || tc="FAIL($(grep -c 'error TS' /tmp/fs-tc.log))"
  fi
  if grep -q '"lint"' package.json 2>/dev/null; then
    npm run -s lint > /tmp/fs-li.log 2>&1 && li="PASS" || li="FAIL($(grep -cE '  error  ' /tmp/fs-li.log))"
  fi
  if grep -q '"test"' package.json 2>/dev/null; then
    npm test > /tmp/fs-tt.log 2>&1 && tt="PASS($(grep -E '^ℹ pass' /tmp/fs-tt.log | grep -oE '[0-9]+'))" || tt="FAIL($(grep -E '^ℹ fail' /tmp/fs-tt.log | grep -oE '[0-9]+') fails)"
  fi
  echo "$d | typecheck=$tc | lint=$li | test=$tt" | tee -a "$OUT"
done
echo "FINAL_SWEEP_DONE" >> "$OUT"
