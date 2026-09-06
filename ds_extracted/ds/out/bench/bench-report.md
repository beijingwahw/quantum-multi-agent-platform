# QuantumSched-Bench — the reproducible battle record

> Generated 2026-09-06T11:47:16.207Z, seed 42. Referee: brute-force enumeration, always. Welfare recomputed by the single accounting function — no solver self-report. Losses ship as losses (the anti-selection law).

## Track: linear

| solver | hits/cells | mean gap | worst gap |
| --- | --- | --- | --- |
| hungarian | 25/25 | 0.0000 | 0.0000 |
| greedy | 18/25 | 0.0120 | 0.1089 |
| greedy+local-search | 22/25 | 0.0016 | 0.0228 |
| simulated-annealing | 24/25 | 0.0001 | 0.0013 |
| subspace-exact | 25/25 | 0.0000 | 0.0000 |
| qaoa-full-space | 13/20 (+5 skipped) | 0.0239 | 0.1916 |
| anneal-full-space | 19/20 (+5 skipped) | 0.0006 | 0.0128 |

## Track: np-hard

| solver | hits/cells | mean gap | worst gap |
| --- | --- | --- | --- |
| hungarian | 12/25 | 0.0622 | 0.2161 |
| greedy | 10/25 | 0.0609 | 0.1380 |
| greedy+local-search | 21/25 | 0.0095 | 0.1353 |
| simulated-annealing | 23/25 | 0.0024 | 0.0350 |
| subspace-exact | 25/25 | 0.0000 | 0.0000 |
| qaoa-full-space | 18/20 (+5 skipped) | 0.0083 | 0.1037 |
| anneal-full-space | 20/20 (+5 skipped) | 0.0000 | 0.0000 |

## Per-instance rows

| instance | solver | welfare | optimal | gap | hit |
| --- | --- | --- | --- | --- | --- |
| np-hard-m2n3-s100 | hungarian | 1.2940 | 1.4920 | 0.1327 | no |
| linear-m2n3-s100 | hungarian | 1.2940 | 1.2940 | 0.0000 | YES |
| np-hard-m2n3-s200 | hungarian | 1.2010 | 1.5320 | 0.2161 | no |
| linear-m2n3-s200 | hungarian | 1.2010 | 1.2010 | 0.0000 | YES |
| np-hard-m2n3-s300 | hungarian | 1.5480 | 1.5480 | 0.0000 | YES |
| linear-m2n3-s300 | hungarian | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n3-s400 | hungarian | 1.6790 | 1.6790 | 0.0000 | YES |
| linear-m2n3-s400 | hungarian | 1.3290 | 1.3290 | 0.0000 | YES |
| np-hard-m2n3-s500 | hungarian | 1.7700 | 1.7700 | 0.0000 | YES |
| linear-m2n3-s500 | hungarian | 1.4200 | 1.4200 | 0.0000 | YES |
| np-hard-m2n4-s100 | hungarian | 1.4030 | 1.4030 | 0.0000 | YES |
| linear-m2n4-s100 | hungarian | 1.4030 | 1.4030 | 0.0000 | YES |
| np-hard-m2n4-s200 | hungarian | 1.4130 | 1.6340 | 0.1353 | no |
| linear-m2n4-s200 | hungarian | 1.4130 | 1.4130 | 0.0000 | YES |
| np-hard-m2n4-s300 | hungarian | 1.8980 | 1.8980 | 0.0000 | YES |
| linear-m2n4-s300 | hungarian | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n4-s400 | hungarian | 1.4050 | 1.6300 | 0.1380 | no |
| linear-m2n4-s400 | hungarian | 1.4050 | 1.4050 | 0.0000 | YES |
| np-hard-m2n4-s500 | hungarian | 1.5710 | 1.8210 | 0.1373 | no |
| linear-m2n4-s500 | hungarian | 1.5710 | 1.5710 | 0.0000 | YES |
| np-hard-m3n4-s100 | hungarian | 1.9950 | 2.1610 | 0.0768 | no |
| linear-m3n4-s100 | hungarian | 1.9950 | 1.9950 | 0.0000 | YES |
| np-hard-m3n4-s200 | hungarian | 2.1980 | 2.5180 | 0.1271 | no |
| linear-m3n4-s200 | hungarian | 2.1980 | 2.1980 | 0.0000 | YES |
| np-hard-m3n4-s300 | hungarian | 2.7010 | 2.7010 | 0.0000 | YES |
| linear-m3n4-s300 | hungarian | 2.3510 | 2.3510 | 0.0000 | YES |
| np-hard-m3n4-s400 | hungarian | 2.1480 | 2.4700 | 0.1304 | no |
| linear-m3n4-s400 | hungarian | 2.1480 | 2.1480 | 0.0000 | YES |
| np-hard-m3n4-s500 | hungarian | 2.3580 | 2.6080 | 0.0959 | no |
| linear-m3n4-s500 | hungarian | 2.3580 | 2.3580 | 0.0000 | YES |
| np-hard-m3n5-s100 | hungarian | 1.8790 | 2.0370 | 0.0776 | no |
| linear-m3n5-s100 | hungarian | 1.8790 | 1.8790 | 0.0000 | YES |
| np-hard-m3n5-s200 | hungarian | 2.2740 | 2.6230 | 0.1331 | no |
| linear-m3n5-s200 | hungarian | 2.2740 | 2.2740 | 0.0000 | YES |
| np-hard-m3n5-s300 | hungarian | 2.4640 | 2.4640 | 0.0000 | YES |
| linear-m3n5-s300 | hungarian | 2.1140 | 2.1140 | 0.0000 | YES |
| np-hard-m3n5-s400 | hungarian | 2.6790 | 2.6790 | 0.0000 | YES |
| linear-m3n5-s400 | hungarian | 2.3290 | 2.3290 | 0.0000 | YES |
| np-hard-m3n5-s500 | hungarian | 2.0890 | 2.2880 | 0.0870 | no |
| linear-m3n5-s500 | hungarian | 2.0890 | 2.0890 | 0.0000 | YES |
| np-hard-m6n8-s500 | hungarian | 4.6110 | 4.9520 | 0.0689 | no |
| linear-m6n8-s500 | hungarian | 4.6110 | 4.6110 | 0.0000 | YES |
| np-hard-m6n8-s1000 | hungarian | 4.8580 | 4.8580 | 0.0000 | YES |
| linear-m6n8-s1000 | hungarian | 4.5080 | 4.5080 | 0.0000 | YES |
| np-hard-m6n8-s1500 | hungarian | 4.9610 | 4.9610 | 0.0000 | YES |
| linear-m6n8-s1500 | hungarian | 4.6110 | 4.6110 | 0.0000 | YES |
| np-hard-m6n8-s2000 | hungarian | 4.9900 | 4.9900 | 0.0000 | YES |
| linear-m6n8-s2000 | hungarian | 4.6400 | 4.6400 | 0.0000 | YES |
| np-hard-m6n8-s2500 | hungarian | 5.1580 | 5.1580 | 0.0000 | YES |
| linear-m6n8-s2500 | hungarian | 4.8080 | 4.8080 | 0.0000 | YES |
| np-hard-m2n3-s100 | greedy | 1.2940 | 1.4920 | 0.1327 | no |
| linear-m2n3-s100 | greedy | 1.2940 | 1.2940 | 0.0000 | YES |
| np-hard-m2n3-s200 | greedy | 1.5320 | 1.5320 | 0.0000 | YES |
| linear-m2n3-s200 | greedy | 1.1820 | 1.2010 | 0.0158 | no |
| np-hard-m2n3-s300 | greedy | 1.5480 | 1.5480 | 0.0000 | YES |
| linear-m2n3-s300 | greedy | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n3-s400 | greedy | 1.6790 | 1.6790 | 0.0000 | YES |
| linear-m2n3-s400 | greedy | 1.3290 | 1.3290 | 0.0000 | YES |
| np-hard-m2n3-s500 | greedy | 1.7700 | 1.7700 | 0.0000 | YES |
| linear-m2n3-s500 | greedy | 1.4200 | 1.4200 | 0.0000 | YES |
| np-hard-m2n4-s100 | greedy | 1.4030 | 1.4030 | 0.0000 | YES |
| linear-m2n4-s100 | greedy | 1.4030 | 1.4030 | 0.0000 | YES |
| np-hard-m2n4-s200 | greedy | 1.4130 | 1.6340 | 0.1353 | no |
| linear-m2n4-s200 | greedy | 1.4130 | 1.4130 | 0.0000 | YES |
| np-hard-m2n4-s300 | greedy | 1.8980 | 1.8980 | 0.0000 | YES |
| linear-m2n4-s300 | greedy | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n4-s400 | greedy | 1.4050 | 1.6300 | 0.1380 | no |
| linear-m2n4-s400 | greedy | 1.4050 | 1.4050 | 0.0000 | YES |
| np-hard-m2n4-s500 | greedy | 1.5710 | 1.8210 | 0.1373 | no |
| linear-m2n4-s500 | greedy | 1.5710 | 1.5710 | 0.0000 | YES |
| np-hard-m3n4-s100 | greedy | 1.9950 | 2.1610 | 0.0768 | no |
| linear-m3n4-s100 | greedy | 1.9950 | 1.9950 | 0.0000 | YES |
| np-hard-m3n4-s200 | greedy | 2.1980 | 2.5180 | 0.1271 | no |
| linear-m3n4-s200 | greedy | 2.1980 | 2.1980 | 0.0000 | YES |
| np-hard-m3n4-s300 | greedy | 2.4880 | 2.7010 | 0.0789 | no |
| linear-m3n4-s300 | greedy | 2.1380 | 2.3510 | 0.0906 | no |
| np-hard-m3n4-s400 | greedy | 2.2640 | 2.4700 | 0.0834 | no |
| linear-m3n4-s400 | greedy | 1.9140 | 2.1480 | 0.1089 | no |
| np-hard-m3n4-s500 | greedy | 2.3580 | 2.6080 | 0.0959 | no |
| linear-m3n4-s500 | greedy | 2.3580 | 2.3580 | 0.0000 | YES |
| np-hard-m3n5-s100 | greedy | 1.7990 | 2.0370 | 0.1168 | no |
| linear-m3n5-s100 | greedy | 1.7990 | 1.8790 | 0.0426 | no |
| np-hard-m3n5-s200 | greedy | 2.2740 | 2.6230 | 0.1331 | no |
| linear-m3n5-s200 | greedy | 2.2740 | 2.2740 | 0.0000 | YES |
| np-hard-m3n5-s300 | greedy | 2.4640 | 2.4640 | 0.0000 | YES |
| linear-m3n5-s300 | greedy | 2.1140 | 2.1140 | 0.0000 | YES |
| np-hard-m3n5-s400 | greedy | 2.6790 | 2.6790 | 0.0000 | YES |
| linear-m3n5-s400 | greedy | 2.3290 | 2.3290 | 0.0000 | YES |
| np-hard-m3n5-s500 | greedy | 2.0890 | 2.2880 | 0.0870 | no |
| linear-m3n5-s500 | greedy | 2.0890 | 2.0890 | 0.0000 | YES |
| np-hard-m6n8-s500 | greedy | 4.5530 | 4.9520 | 0.0806 | no |
| linear-m6n8-s500 | greedy | 4.5530 | 4.6110 | 0.0126 | no |
| np-hard-m6n8-s1000 | greedy | 4.5020 | 4.8580 | 0.0733 | no |
| linear-m6n8-s1000 | greedy | 4.5020 | 4.5080 | 0.0013 | no |
| np-hard-m6n8-s1500 | greedy | 4.9610 | 4.9610 | 0.0000 | YES |
| linear-m6n8-s1500 | greedy | 4.6110 | 4.6110 | 0.0000 | YES |
| np-hard-m6n8-s2000 | greedy | 4.8630 | 4.9900 | 0.0255 | no |
| linear-m6n8-s2000 | greedy | 4.5130 | 4.6400 | 0.0274 | no |
| np-hard-m6n8-s2500 | greedy | 5.1580 | 5.1580 | 0.0000 | YES |
| linear-m6n8-s2500 | greedy | 4.8080 | 4.8080 | 0.0000 | YES |
| np-hard-m2n3-s100 | greedy+local-search | 1.4920 | 1.4920 | 0.0000 | YES |
| linear-m2n3-s100 | greedy+local-search | 1.2940 | 1.2940 | 0.0000 | YES |
| np-hard-m2n3-s200 | greedy+local-search | 1.5320 | 1.5320 | 0.0000 | YES |
| linear-m2n3-s200 | greedy+local-search | 1.1820 | 1.2010 | 0.0158 | no |
| np-hard-m2n3-s300 | greedy+local-search | 1.5480 | 1.5480 | 0.0000 | YES |
| linear-m2n3-s300 | greedy+local-search | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n3-s400 | greedy+local-search | 1.6790 | 1.6790 | 0.0000 | YES |
| linear-m2n3-s400 | greedy+local-search | 1.3290 | 1.3290 | 0.0000 | YES |
| np-hard-m2n3-s500 | greedy+local-search | 1.7700 | 1.7700 | 0.0000 | YES |
| linear-m2n3-s500 | greedy+local-search | 1.4200 | 1.4200 | 0.0000 | YES |
| np-hard-m2n4-s100 | greedy+local-search | 1.4030 | 1.4030 | 0.0000 | YES |
| linear-m2n4-s100 | greedy+local-search | 1.4030 | 1.4030 | 0.0000 | YES |
| np-hard-m2n4-s200 | greedy+local-search | 1.4130 | 1.6340 | 0.1353 | no |
| linear-m2n4-s200 | greedy+local-search | 1.4130 | 1.4130 | 0.0000 | YES |
| np-hard-m2n4-s300 | greedy+local-search | 1.8980 | 1.8980 | 0.0000 | YES |
| linear-m2n4-s300 | greedy+local-search | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n4-s400 | greedy+local-search | 1.6300 | 1.6300 | 0.0000 | YES |
| linear-m2n4-s400 | greedy+local-search | 1.4050 | 1.4050 | 0.0000 | YES |
| np-hard-m2n4-s500 | greedy+local-search | 1.8210 | 1.8210 | 0.0000 | YES |
| linear-m2n4-s500 | greedy+local-search | 1.5710 | 1.5710 | 0.0000 | YES |
| np-hard-m3n4-s100 | greedy+local-search | 2.1610 | 2.1610 | 0.0000 | YES |
| linear-m3n4-s100 | greedy+local-search | 1.9950 | 1.9950 | 0.0000 | YES |
| np-hard-m3n4-s200 | greedy+local-search | 2.5180 | 2.5180 | 0.0000 | YES |
| linear-m3n4-s200 | greedy+local-search | 2.1980 | 2.1980 | 0.0000 | YES |
| np-hard-m3n4-s300 | greedy+local-search | 2.7010 | 2.7010 | 0.0000 | YES |
| linear-m3n4-s300 | greedy+local-search | 2.3510 | 2.3510 | 0.0000 | YES |
| np-hard-m3n4-s400 | greedy+local-search | 2.4700 | 2.4700 | 0.0000 | YES |
| linear-m3n4-s400 | greedy+local-search | 2.1480 | 2.1480 | 0.0000 | YES |
| np-hard-m3n4-s500 | greedy+local-search | 2.6080 | 2.6080 | 0.0000 | YES |
| linear-m3n4-s500 | greedy+local-search | 2.3580 | 2.3580 | 0.0000 | YES |
| np-hard-m3n5-s100 | greedy+local-search | 2.0370 | 2.0370 | 0.0000 | YES |
| linear-m3n5-s100 | greedy+local-search | 1.8790 | 1.8790 | 0.0000 | YES |
| np-hard-m3n5-s200 | greedy+local-search | 2.6230 | 2.6230 | 0.0000 | YES |
| linear-m3n5-s200 | greedy+local-search | 2.2740 | 2.2740 | 0.0000 | YES |
| np-hard-m3n5-s300 | greedy+local-search | 2.4640 | 2.4640 | 0.0000 | YES |
| linear-m3n5-s300 | greedy+local-search | 2.1140 | 2.1140 | 0.0000 | YES |
| np-hard-m3n5-s400 | greedy+local-search | 2.6790 | 2.6790 | 0.0000 | YES |
| linear-m3n5-s400 | greedy+local-search | 2.3290 | 2.3290 | 0.0000 | YES |
| np-hard-m3n5-s500 | greedy+local-search | 2.2880 | 2.2880 | 0.0000 | YES |
| linear-m3n5-s500 | greedy+local-search | 2.0890 | 2.0890 | 0.0000 | YES |
| np-hard-m6n8-s500 | greedy+local-search | 4.6110 | 4.9520 | 0.0689 | no |
| linear-m6n8-s500 | greedy+local-search | 4.6110 | 4.6110 | 0.0000 | YES |
| np-hard-m6n8-s1000 | greedy+local-search | 4.8000 | 4.8580 | 0.0119 | no |
| linear-m6n8-s1000 | greedy+local-search | 4.5020 | 4.5080 | 0.0013 | no |
| np-hard-m6n8-s1500 | greedy+local-search | 4.9610 | 4.9610 | 0.0000 | YES |
| linear-m6n8-s1500 | greedy+local-search | 4.6110 | 4.6110 | 0.0000 | YES |
| np-hard-m6n8-s2000 | greedy+local-search | 4.8840 | 4.9900 | 0.0212 | no |
| linear-m6n8-s2000 | greedy+local-search | 4.5340 | 4.6400 | 0.0228 | no |
| np-hard-m6n8-s2500 | greedy+local-search | 5.1580 | 5.1580 | 0.0000 | YES |
| linear-m6n8-s2500 | greedy+local-search | 4.8080 | 4.8080 | 0.0000 | YES |
| np-hard-m2n3-s100 | simulated-annealing | 1.4920 | 1.4920 | 0.0000 | YES |
| linear-m2n3-s100 | simulated-annealing | 1.2940 | 1.2940 | 0.0000 | YES |
| np-hard-m2n3-s200 | simulated-annealing | 1.5320 | 1.5320 | 0.0000 | YES |
| linear-m2n3-s200 | simulated-annealing | 1.2010 | 1.2010 | 0.0000 | YES |
| np-hard-m2n3-s300 | simulated-annealing | 1.5480 | 1.5480 | 0.0000 | YES |
| linear-m2n3-s300 | simulated-annealing | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n3-s400 | simulated-annealing | 1.6790 | 1.6790 | 0.0000 | YES |
| linear-m2n3-s400 | simulated-annealing | 1.3290 | 1.3290 | 0.0000 | YES |
| np-hard-m2n3-s500 | simulated-annealing | 1.7700 | 1.7700 | 0.0000 | YES |
| linear-m2n3-s500 | simulated-annealing | 1.4200 | 1.4200 | 0.0000 | YES |
| np-hard-m2n4-s100 | simulated-annealing | 1.4030 | 1.4030 | 0.0000 | YES |
| linear-m2n4-s100 | simulated-annealing | 1.4030 | 1.4030 | 0.0000 | YES |
| np-hard-m2n4-s200 | simulated-annealing | 1.6340 | 1.6340 | 0.0000 | YES |
| linear-m2n4-s200 | simulated-annealing | 1.4130 | 1.4130 | 0.0000 | YES |
| np-hard-m2n4-s300 | simulated-annealing | 1.8980 | 1.8980 | 0.0000 | YES |
| linear-m2n4-s300 | simulated-annealing | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n4-s400 | simulated-annealing | 1.6300 | 1.6300 | 0.0000 | YES |
| linear-m2n4-s400 | simulated-annealing | 1.4050 | 1.4050 | 0.0000 | YES |
| np-hard-m2n4-s500 | simulated-annealing | 1.8210 | 1.8210 | 0.0000 | YES |
| linear-m2n4-s500 | simulated-annealing | 1.5710 | 1.5710 | 0.0000 | YES |
| np-hard-m3n4-s100 | simulated-annealing | 2.1610 | 2.1610 | 0.0000 | YES |
| linear-m3n4-s100 | simulated-annealing | 1.9950 | 1.9950 | 0.0000 | YES |
| np-hard-m3n4-s200 | simulated-annealing | 2.5180 | 2.5180 | 0.0000 | YES |
| linear-m3n4-s200 | simulated-annealing | 2.1980 | 2.1980 | 0.0000 | YES |
| np-hard-m3n4-s300 | simulated-annealing | 2.7010 | 2.7010 | 0.0000 | YES |
| linear-m3n4-s300 | simulated-annealing | 2.3510 | 2.3510 | 0.0000 | YES |
| np-hard-m3n4-s400 | simulated-annealing | 2.4700 | 2.4700 | 0.0000 | YES |
| linear-m3n4-s400 | simulated-annealing | 2.1480 | 2.1480 | 0.0000 | YES |
| np-hard-m3n4-s500 | simulated-annealing | 2.6080 | 2.6080 | 0.0000 | YES |
| linear-m3n4-s500 | simulated-annealing | 2.3580 | 2.3580 | 0.0000 | YES |
| np-hard-m3n5-s100 | simulated-annealing | 2.0370 | 2.0370 | 0.0000 | YES |
| linear-m3n5-s100 | simulated-annealing | 1.8790 | 1.8790 | 0.0000 | YES |
| np-hard-m3n5-s200 | simulated-annealing | 2.6230 | 2.6230 | 0.0000 | YES |
| linear-m3n5-s200 | simulated-annealing | 2.2740 | 2.2740 | 0.0000 | YES |
| np-hard-m3n5-s300 | simulated-annealing | 2.4640 | 2.4640 | 0.0000 | YES |
| linear-m3n5-s300 | simulated-annealing | 2.1140 | 2.1140 | 0.0000 | YES |
| np-hard-m3n5-s400 | simulated-annealing | 2.6790 | 2.6790 | 0.0000 | YES |
| linear-m3n5-s400 | simulated-annealing | 2.3290 | 2.3290 | 0.0000 | YES |
| np-hard-m3n5-s500 | simulated-annealing | 2.2880 | 2.2880 | 0.0000 | YES |
| linear-m3n5-s500 | simulated-annealing | 2.0890 | 2.0890 | 0.0000 | YES |
| np-hard-m6n8-s500 | simulated-annealing | 4.9520 | 4.9520 | 0.0000 | YES |
| linear-m6n8-s500 | simulated-annealing | 4.6110 | 4.6110 | 0.0000 | YES |
| np-hard-m6n8-s1000 | simulated-annealing | 4.6880 | 4.8580 | 0.0350 | no |
| linear-m6n8-s1000 | simulated-annealing | 4.5020 | 4.5080 | 0.0013 | no |
| np-hard-m6n8-s1500 | simulated-annealing | 4.9610 | 4.9610 | 0.0000 | YES |
| linear-m6n8-s1500 | simulated-annealing | 4.6110 | 4.6110 | 0.0000 | YES |
| np-hard-m6n8-s2000 | simulated-annealing | 4.8630 | 4.9900 | 0.0255 | no |
| linear-m6n8-s2000 | simulated-annealing | 4.6400 | 4.6400 | 0.0000 | YES |
| np-hard-m6n8-s2500 | simulated-annealing | 5.1580 | 5.1580 | 0.0000 | YES |
| linear-m6n8-s2500 | simulated-annealing | 4.8080 | 4.8080 | 0.0000 | YES |
| np-hard-m2n3-s100 | subspace-exact | 1.4920 | 1.4920 | 0.0000 | YES |
| linear-m2n3-s100 | subspace-exact | 1.2940 | 1.2940 | 0.0000 | YES |
| np-hard-m2n3-s200 | subspace-exact | 1.5320 | 1.5320 | 0.0000 | YES |
| linear-m2n3-s200 | subspace-exact | 1.2010 | 1.2010 | 0.0000 | YES |
| np-hard-m2n3-s300 | subspace-exact | 1.5480 | 1.5480 | 0.0000 | YES |
| linear-m2n3-s300 | subspace-exact | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n3-s400 | subspace-exact | 1.6790 | 1.6790 | 0.0000 | YES |
| linear-m2n3-s400 | subspace-exact | 1.3290 | 1.3290 | 0.0000 | YES |
| np-hard-m2n3-s500 | subspace-exact | 1.7700 | 1.7700 | 0.0000 | YES |
| linear-m2n3-s500 | subspace-exact | 1.4200 | 1.4200 | 0.0000 | YES |
| np-hard-m2n4-s100 | subspace-exact | 1.4030 | 1.4030 | 0.0000 | YES |
| linear-m2n4-s100 | subspace-exact | 1.4030 | 1.4030 | 0.0000 | YES |
| np-hard-m2n4-s200 | subspace-exact | 1.6340 | 1.6340 | 0.0000 | YES |
| linear-m2n4-s200 | subspace-exact | 1.4130 | 1.4130 | 0.0000 | YES |
| np-hard-m2n4-s300 | subspace-exact | 1.8980 | 1.8980 | 0.0000 | YES |
| linear-m2n4-s300 | subspace-exact | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n4-s400 | subspace-exact | 1.6300 | 1.6300 | 0.0000 | YES |
| linear-m2n4-s400 | subspace-exact | 1.4050 | 1.4050 | 0.0000 | YES |
| np-hard-m2n4-s500 | subspace-exact | 1.8210 | 1.8210 | 0.0000 | YES |
| linear-m2n4-s500 | subspace-exact | 1.5710 | 1.5710 | 0.0000 | YES |
| np-hard-m3n4-s100 | subspace-exact | 2.1610 | 2.1610 | 0.0000 | YES |
| linear-m3n4-s100 | subspace-exact | 1.9950 | 1.9950 | 0.0000 | YES |
| np-hard-m3n4-s200 | subspace-exact | 2.5180 | 2.5180 | 0.0000 | YES |
| linear-m3n4-s200 | subspace-exact | 2.1980 | 2.1980 | 0.0000 | YES |
| np-hard-m3n4-s300 | subspace-exact | 2.7010 | 2.7010 | 0.0000 | YES |
| linear-m3n4-s300 | subspace-exact | 2.3510 | 2.3510 | 0.0000 | YES |
| np-hard-m3n4-s400 | subspace-exact | 2.4700 | 2.4700 | 0.0000 | YES |
| linear-m3n4-s400 | subspace-exact | 2.1480 | 2.1480 | 0.0000 | YES |
| np-hard-m3n4-s500 | subspace-exact | 2.6080 | 2.6080 | 0.0000 | YES |
| linear-m3n4-s500 | subspace-exact | 2.3580 | 2.3580 | 0.0000 | YES |
| np-hard-m3n5-s100 | subspace-exact | 2.0370 | 2.0370 | 0.0000 | YES |
| linear-m3n5-s100 | subspace-exact | 1.8790 | 1.8790 | 0.0000 | YES |
| np-hard-m3n5-s200 | subspace-exact | 2.6230 | 2.6230 | 0.0000 | YES |
| linear-m3n5-s200 | subspace-exact | 2.2740 | 2.2740 | 0.0000 | YES |
| np-hard-m3n5-s300 | subspace-exact | 2.4640 | 2.4640 | 0.0000 | YES |
| linear-m3n5-s300 | subspace-exact | 2.1140 | 2.1140 | 0.0000 | YES |
| np-hard-m3n5-s400 | subspace-exact | 2.6790 | 2.6790 | 0.0000 | YES |
| linear-m3n5-s400 | subspace-exact | 2.3290 | 2.3290 | 0.0000 | YES |
| np-hard-m3n5-s500 | subspace-exact | 2.2880 | 2.2880 | 0.0000 | YES |
| linear-m3n5-s500 | subspace-exact | 2.0890 | 2.0890 | 0.0000 | YES |
| np-hard-m6n8-s500 | subspace-exact | 4.9520 | 4.9520 | 0.0000 | YES |
| linear-m6n8-s500 | subspace-exact | 4.6110 | 4.6110 | 0.0000 | YES |
| np-hard-m6n8-s1000 | subspace-exact | 4.8580 | 4.8580 | 0.0000 | YES |
| linear-m6n8-s1000 | subspace-exact | 4.5080 | 4.5080 | 0.0000 | YES |
| np-hard-m6n8-s1500 | subspace-exact | 4.9610 | 4.9610 | 0.0000 | YES |
| linear-m6n8-s1500 | subspace-exact | 4.6110 | 4.6110 | 0.0000 | YES |
| np-hard-m6n8-s2000 | subspace-exact | 4.9900 | 4.9900 | 0.0000 | YES |
| linear-m6n8-s2000 | subspace-exact | 4.6400 | 4.6400 | 0.0000 | YES |
| np-hard-m6n8-s2500 | subspace-exact | 5.1580 | 5.1580 | 0.0000 | YES |
| linear-m6n8-s2500 | subspace-exact | 4.8080 | 4.8080 | 0.0000 | YES |
| np-hard-m2n3-s100 | qaoa-full-space | 1.4920 | 1.4920 | 0.0000 | YES |
| linear-m2n3-s100 | qaoa-full-space | 1.2940 | 1.2940 | 0.0000 | YES |
| np-hard-m2n3-s200 | qaoa-full-space | 1.5320 | 1.5320 | 0.0000 | YES |
| linear-m2n3-s200 | qaoa-full-space | 1.2010 | 1.2010 | 0.0000 | YES |
| np-hard-m2n3-s300 | qaoa-full-space | 1.5480 | 1.5480 | 0.0000 | YES |
| linear-m2n3-s300 | qaoa-full-space | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n3-s400 | qaoa-full-space | 1.6790 | 1.6790 | 0.0000 | YES |
| linear-m2n3-s400 | qaoa-full-space | 1.3290 | 1.3290 | 0.0000 | YES |
| np-hard-m2n3-s500 | qaoa-full-space | 1.7700 | 1.7700 | 0.0000 | YES |
| linear-m2n3-s500 | qaoa-full-space | 1.4200 | 1.4200 | 0.0000 | YES |
| np-hard-m2n4-s100 | qaoa-full-space | 1.4030 | 1.4030 | 0.0000 | YES |
| linear-m2n4-s100 | qaoa-full-space | 1.4030 | 1.4030 | 0.0000 | YES |
| np-hard-m2n4-s200 | qaoa-full-space | 1.6340 | 1.6340 | 0.0000 | YES |
| linear-m2n4-s200 | qaoa-full-space | 1.4130 | 1.4130 | 0.0000 | YES |
| np-hard-m2n4-s300 | qaoa-full-space | 1.8980 | 1.8980 | 0.0000 | YES |
| linear-m2n4-s300 | qaoa-full-space | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n4-s400 | qaoa-full-space | 1.6300 | 1.6300 | 0.0000 | YES |
| linear-m2n4-s400 | qaoa-full-space | 1.4050 | 1.4050 | 0.0000 | YES |
| np-hard-m2n4-s500 | qaoa-full-space | 1.8210 | 1.8210 | 0.0000 | YES |
| linear-m2n4-s500 | qaoa-full-space | 1.5710 | 1.5710 | 0.0000 | YES |
| np-hard-m3n4-s100 | qaoa-full-space | 2.1610 | 2.1610 | 0.0000 | YES |
| linear-m3n4-s100 | qaoa-full-space | 1.9950 | 1.9950 | 0.0000 | YES |
| np-hard-m3n4-s200 | qaoa-full-space | 2.5180 | 2.5180 | 0.0000 | YES |
| linear-m3n4-s200 | qaoa-full-space | 2.1160 | 2.1980 | 0.0373 | no |
| np-hard-m3n4-s300 | qaoa-full-space | 2.7010 | 2.7010 | 0.0000 | YES |
| linear-m3n4-s300 | qaoa-full-space | 2.3510 | 2.3510 | 0.0000 | YES |
| np-hard-m3n4-s400 | qaoa-full-space | 2.4700 | 2.4700 | 0.0000 | YES |
| linear-m3n4-s400 | qaoa-full-space | 2.0410 | 2.1480 | 0.0498 | no |
| np-hard-m3n4-s500 | qaoa-full-space | 2.6080 | 2.6080 | 0.0000 | YES |
| linear-m3n4-s500 | qaoa-full-space | 2.2580 | 2.3580 | 0.0424 | no |
| np-hard-m3n5-s100 | qaoa-full-space | 2.0370 | 2.0370 | 0.0000 | YES |
| linear-m3n5-s100 | qaoa-full-space | 1.5190 | 1.8790 | 0.1916 | no |
| np-hard-m3n5-s200 | qaoa-full-space | 2.3510 | 2.6230 | 0.1037 | no |
| linear-m3n5-s200 | qaoa-full-space | 2.2260 | 2.2740 | 0.0211 | no |
| np-hard-m3n5-s300 | qaoa-full-space | 2.4640 | 2.4640 | 0.0000 | YES |
| linear-m3n5-s300 | qaoa-full-space | 2.0890 | 2.1140 | 0.0118 | no |
| np-hard-m3n5-s400 | qaoa-full-space | 2.6790 | 2.6790 | 0.0000 | YES |
| linear-m3n5-s400 | qaoa-full-space | 2.0420 | 2.3290 | 0.1232 | no |
| np-hard-m3n5-s500 | qaoa-full-space | 2.1450 | 2.2880 | 0.0625 | no |
| linear-m3n5-s500 | qaoa-full-space | 2.0890 | 2.0890 | 0.0000 | YES |
| np-hard-m6n8-s500 | qaoa-full-space | skipped (over the solver's qubit cap) | 4.9520 | — | — |
| linear-m6n8-s500 | qaoa-full-space | skipped (over the solver's qubit cap) | 4.6110 | — | — |
| np-hard-m6n8-s1000 | qaoa-full-space | skipped (over the solver's qubit cap) | 4.8580 | — | — |
| linear-m6n8-s1000 | qaoa-full-space | skipped (over the solver's qubit cap) | 4.5080 | — | — |
| np-hard-m6n8-s1500 | qaoa-full-space | skipped (over the solver's qubit cap) | 4.9610 | — | — |
| linear-m6n8-s1500 | qaoa-full-space | skipped (over the solver's qubit cap) | 4.6110 | — | — |
| np-hard-m6n8-s2000 | qaoa-full-space | skipped (over the solver's qubit cap) | 4.9900 | — | — |
| linear-m6n8-s2000 | qaoa-full-space | skipped (over the solver's qubit cap) | 4.6400 | — | — |
| np-hard-m6n8-s2500 | qaoa-full-space | skipped (over the solver's qubit cap) | 5.1580 | — | — |
| linear-m6n8-s2500 | qaoa-full-space | skipped (over the solver's qubit cap) | 4.8080 | — | — |
| np-hard-m2n3-s100 | anneal-full-space | 1.4920 | 1.4920 | 0.0000 | YES |
| linear-m2n3-s100 | anneal-full-space | 1.2940 | 1.2940 | 0.0000 | YES |
| np-hard-m2n3-s200 | anneal-full-space | 1.5320 | 1.5320 | 0.0000 | YES |
| linear-m2n3-s200 | anneal-full-space | 1.2010 | 1.2010 | 0.0000 | YES |
| np-hard-m2n3-s300 | anneal-full-space | 1.5480 | 1.5480 | 0.0000 | YES |
| linear-m2n3-s300 | anneal-full-space | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n3-s400 | anneal-full-space | 1.6790 | 1.6790 | 0.0000 | YES |
| linear-m2n3-s400 | anneal-full-space | 1.3290 | 1.3290 | 0.0000 | YES |
| np-hard-m2n3-s500 | anneal-full-space | 1.7700 | 1.7700 | 0.0000 | YES |
| linear-m2n3-s500 | anneal-full-space | 1.4200 | 1.4200 | 0.0000 | YES |
| np-hard-m2n4-s100 | anneal-full-space | 1.4030 | 1.4030 | 0.0000 | YES |
| linear-m2n4-s100 | anneal-full-space | 1.4030 | 1.4030 | 0.0000 | YES |
| np-hard-m2n4-s200 | anneal-full-space | 1.6340 | 1.6340 | 0.0000 | YES |
| linear-m2n4-s200 | anneal-full-space | 1.4130 | 1.4130 | 0.0000 | YES |
| np-hard-m2n4-s300 | anneal-full-space | 1.8980 | 1.8980 | 0.0000 | YES |
| linear-m2n4-s300 | anneal-full-space | 1.5480 | 1.5480 | 0.0000 | YES |
| np-hard-m2n4-s400 | anneal-full-space | 1.6300 | 1.6300 | 0.0000 | YES |
| linear-m2n4-s400 | anneal-full-space | 1.4050 | 1.4050 | 0.0000 | YES |
| np-hard-m2n4-s500 | anneal-full-space | 1.8210 | 1.8210 | 0.0000 | YES |
| linear-m2n4-s500 | anneal-full-space | 1.5710 | 1.5710 | 0.0000 | YES |
| np-hard-m3n4-s100 | anneal-full-space | 2.1610 | 2.1610 | 0.0000 | YES |
| linear-m3n4-s100 | anneal-full-space | 1.9950 | 1.9950 | 0.0000 | YES |
| np-hard-m3n4-s200 | anneal-full-space | 2.5180 | 2.5180 | 0.0000 | YES |
| linear-m3n4-s200 | anneal-full-space | 2.1980 | 2.1980 | 0.0000 | YES |
| np-hard-m3n4-s300 | anneal-full-space | 2.7010 | 2.7010 | 0.0000 | YES |
| linear-m3n4-s300 | anneal-full-space | 2.3510 | 2.3510 | 0.0000 | YES |
| np-hard-m3n4-s400 | anneal-full-space | 2.4700 | 2.4700 | 0.0000 | YES |
| linear-m3n4-s400 | anneal-full-space | 2.1480 | 2.1480 | 0.0000 | YES |
| np-hard-m3n4-s500 | anneal-full-space | 2.6080 | 2.6080 | 0.0000 | YES |
| linear-m3n4-s500 | anneal-full-space | 2.3580 | 2.3580 | 0.0000 | YES |
| np-hard-m3n5-s100 | anneal-full-space | 2.0370 | 2.0370 | 0.0000 | YES |
| linear-m3n5-s100 | anneal-full-space | 1.8790 | 1.8790 | 0.0000 | YES |
| np-hard-m3n5-s200 | anneal-full-space | 2.6230 | 2.6230 | 0.0000 | YES |
| linear-m3n5-s200 | anneal-full-space | 2.2740 | 2.2740 | 0.0000 | YES |
| np-hard-m3n5-s300 | anneal-full-space | 2.4640 | 2.4640 | 0.0000 | YES |
| linear-m3n5-s300 | anneal-full-space | 2.0870 | 2.1140 | 0.0128 | no |
| np-hard-m3n5-s400 | anneal-full-space | 2.6790 | 2.6790 | 0.0000 | YES |
| linear-m3n5-s400 | anneal-full-space | 2.3290 | 2.3290 | 0.0000 | YES |
| np-hard-m3n5-s500 | anneal-full-space | 2.2880 | 2.2880 | 0.0000 | YES |
| linear-m3n5-s500 | anneal-full-space | 2.0890 | 2.0890 | 0.0000 | YES |
| np-hard-m6n8-s500 | anneal-full-space | skipped (over the solver's qubit cap) | 4.9520 | — | — |
| linear-m6n8-s500 | anneal-full-space | skipped (over the solver's qubit cap) | 4.6110 | — | — |
| np-hard-m6n8-s1000 | anneal-full-space | skipped (over the solver's qubit cap) | 4.8580 | — | — |
| linear-m6n8-s1000 | anneal-full-space | skipped (over the solver's qubit cap) | 4.5080 | — | — |
| np-hard-m6n8-s1500 | anneal-full-space | skipped (over the solver's qubit cap) | 4.9610 | — | — |
| linear-m6n8-s1500 | anneal-full-space | skipped (over the solver's qubit cap) | 4.6110 | — | — |
| np-hard-m6n8-s2000 | anneal-full-space | skipped (over the solver's qubit cap) | 4.9900 | — | — |
| linear-m6n8-s2000 | anneal-full-space | skipped (over the solver's qubit cap) | 4.6400 | — | — |
| np-hard-m6n8-s2500 | anneal-full-space | skipped (over the solver's qubit cap) | 5.1580 | — | — |
| linear-m6n8-s2500 | anneal-full-space | skipped (over the solver's qubit cap) | 4.8080 | — | — |
