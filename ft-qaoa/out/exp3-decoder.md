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

## Window-size policy sweep (batching tradeoff priced as data)

| fleet | W | utilization | verdict | max e2e delay (us) | correction latency (us) |
|---|---|---|---|---|---|
| fpga-512u | 1 | 2.055 | backlog-grows | 10,458 | 10,459 |
| fpga-512u | 2 | 1.370 | backlog-grows | 11,143 | 11,145 |
| fpga-512u | 4 | 1.027 | backlog-grows | 3,119 | 3,123 |
| fpga-512u | 8 | 0.856 | realtime | 600 | 608 |
| fpga-512u | 16 | 0.771 | realtime | 1,080 | 1,096 |
| fpga-512u | 32 | 0.728 | realtime | 2,040 | 2,072 |
| fpga-32u | 1 | 37.500 | backlog-grows | 19,569 | 19,570 |
| fpga-32u | 2 | 25.000 | backlog-grows | 38,559 | 38,561 |
| fpga-32u | 4 | 18.750 | backlog-grows | 75,999 | 76,003 |
| fpga-32u | 8 | 15.625 | backlog-grows | 150,138 | 150,146 |
| fpga-32u | 16 | 14.063 | backlog-grows | 298,367 | 298,383 |
| fpga-32u | 32 | 13.281 | backlog-grows | 569,908 | 569,940 |
| asic-1us-16u | 1 | 0.750 | realtime | 2 | 3 |
| asic-1us-16u | 2 | 0.500 | realtime | 2 | 4 |
| asic-1us-16u | 4 | 0.375 | realtime | 4 | 8 |
| asic-1us-16u | 8 | 0.313 | realtime | 6 | 14 |
| asic-1us-16u | 16 | 0.281 | realtime | 11 | 27 |
| asic-1us-16u | 32 | 0.266 | realtime | 20 | 52 |

- fpga-512u: minimum-latency realtime window = 8
- fpga-32u: minimum-latency realtime window = none (backlog at every window size)
- asic-1us-16u: minimum-latency realtime window = 1
