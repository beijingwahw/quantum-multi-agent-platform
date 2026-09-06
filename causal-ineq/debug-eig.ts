import { hermitianExtremeEig, cmatEye, type CMat } from "./src/core/cmat.js";
import { wStar, wChannelAB } from "./src/process/construct.js";

// anchor 1: identity 16
console.log("eye16:", hermitianExtremeEig(cmatEye(16)));
// anchor 2: 2x2 [[1,1],[1,-1]] embedded as Hermitian
const m: CMat = { dim: 2, re: [[1, 1], [1, -1]], im: [[0, 0], [0, 0]] };
console.log("[[1,1],[1,-1]] (expect ±√2 = ±1.41421):", hermitianExtremeEig(m));
// anchor 3: Pauli Y
const y: CMat = { dim: 2, re: [[0, 0], [0, 0]], im: [[0, -1], [1, 0]] };
console.log("sigma_y (expect ±1):", hermitianExtremeEig(y));
// anchor 4: W* eigen {0, 1/2}
console.log("wStar(1/sqrt2) (expect {0, 0.5}):", hermitianExtremeEig(wStar(Math.SQRT1_2)));
console.log("wChannelAB (expect {0,1}):", hermitianExtremeEig(wChannelAB()));
