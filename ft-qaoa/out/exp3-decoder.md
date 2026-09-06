# Experiment 3 — Real-time decoder scheduling for the deep-QAOA syndrome stream

Discrete-event simulation, seeded; steady-state utilization from service/arrival.
Regenerate with `npm run exp:decoder`.

Circuit: gross [[144,12,12]], L=80, p=128 -> 614,400 syndrome rounds,
1008 bits/round, sustained 1008.0 Mb/s across 7 blocks.

| scenario | units/block | utilization | max backlog (rounds) | p95 backlog | verdict |
|---|---|---|---|---|---|
| cpu-bposd-1u | 1 | 1125.000 | 159,856 | 151,872 | backlog-grows |
| cpu-bposd-64u | 9 | 125.000 | 158,688 | 150,752 | backlog-grows |
| fpga-100us-32u | 4 | 15.625 | 149,832 | 142,352 | backlog-grows |
| asic-10us-32u | 4 | 1.563 | 65,824 | 62,520 | backlog-grows |
| asic-1us-16u | 2 | 0.313 | 0 | 0 | realtime |
| fpga-256u | 36 | 1.736 | 68,432 | 65,032 | backlog-grows |
| fpga-512u | 73 | 0.856 | 0 | 0 | realtime |
