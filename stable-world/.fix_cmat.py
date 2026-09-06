import re

path = 'src/core/cmat.ts'
with open(path) as f:
    src = f.read()

applied = []

def sub(pattern, repl, note):
    global src
    new = re.sub(pattern, repl, src, count=1)
    if new == src:
        applied.append(('MISS', note))
        return
    src = new
    applied.append(('ok', note))

def sub_all(pattern, repl, note):
    global src
    new, n = re.subn(pattern, repl, src)
    applied.append((f'ok x{n}' if n else 'MISS', note))
    src = new

# basisVec / identity
sub(r'(v\.re\[i\]) = 1;', r'\1! = 1;', 'basisVec')
sub(r'(m\.re\[i \* d \+ i\]) = 1;', r'\1! = 1;', 'identity')
# vAdd / vScale
sub(r'(r\.re\[i\]) = a\.re\[i\] \+ b\.re\[i\];', r'\1! = a.re[i]! + b.re[i]!;', 'vAdd re')
sub(r'(r\.im\[i\]) = a\.im\[i\] \+ b\.im\[i\];', r'\1! = a.im[i]! + b.im[i]!;', 'vAdd im')
sub(r'(r\.re\[i\]) = a\.re\[i\] \* s;', r'\1! = a.re[i]! * s;', 'vScale re')
sub(r'(r\.im\[i\]) = a\.im\[i\] \* s;', r'\1! = a.im[i]! * s;', 'vScale im')
# vInner
sub(r're \+= a\.re\[i\] \* b\.re\[i\] \+ a\.im\[i\] \* b\.im\[i\];', r're += a.re[i]! * b.re[i]! + a.im[i]! * b.im[i]!;', 'vInner re')
sub(r'im \+= a\.re\[i\] \* b\.im\[i\] - a\.im\[i\] \* b\.re\[i\];', r'im += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;', 'vInner im')
# outer
sub(r'(m\.re\[i \* b\.n \+ j\]) = a\.re\[i\] \* b\.re\[j\] \+ a\.im\[i\] \* b\.im\[j\];', r'\1! = a.re[i]! * b.re[j]! + a.im[i]! * b.im[j]!;', 'outer re')
sub(r'(m\.im\[i \* b\.n \+ j\]) = a\.im\[i\] \* b\.re\[j\] - a\.re\[i\] \* b\.im\[j\];', r'\1! = a.im[i]! * b.re[j]! - a.re[i]! * b.im[j]!;', 'outer im')
# mAdd / mScale
sub(r'(m\.re\[k\]) = a\.re\[k\] \+ b\.re\[k\];', r'\1! = a.re[k]! + b.re[k]!;', 'mAdd re')
sub(r'(m\.im\[k\]) = a\.im\[k\] \+ b\.im\[k\];', r'\1! = a.im[k]! + b.im[k]!;', 'mAdd im')
sub(r'(m\.re\[k\]) = a\.re\[k\] \* s;', r'\1! = a.re[k]! * s;', 'mScale re')
sub(r'(m\.im\[k\]) = a\.im\[k\] \* s;', r'\1! = a.im[k]! * s;', 'mScale im')
# mMul
sub(r'const ar = a\.re\[i \* a\.cols \+ k\];', r'const ar = a.re[i * a.cols + k]!;', 'mMul ar')
sub(r'const ai = a\.im\[i \* a\.cols \+ k\];', r'const ai = a.im[i * a.cols + k]!;', 'mMul ai')
sub(r'const br = b\.re\[k \* bn \+ j\];', r'const br = b.re[k * bn + j]!;', 'mMul br')
sub(r'const bi = b\.im\[k \* bn \+ j\];', r'const bi = b.im[k * bn + j]!;', 'mMul bi')
sub(r'(m\.re\[i \* bn \+ j\]) \+= ar \* br - ai \* bi;', r'\1! += ar * br - ai * bi;', 'mMul acc re')
sub(r'(m\.im\[i \* bn \+ j\]) \+= ar \* bi \+ ai \* br;', r'\1! += ar * bi + ai * br;', 'mMul acc im')
# mDagger
sub(r'(m\.re\[j \* a\.rows \+ i\]) = a\.re\[i \* a\.cols \+ j\];', r'\1! = a.re[i * a.cols + j]!;', 'mDagger re')
sub(r'(m\.im\[j \* a\.rows \+ i\]) = -a\.im\[i \* a\.cols \+ j\];', r'\1! = -a.im[i * a.cols + j]!;', 'mDagger im')
# mTrace
sub(r're \+= a\.re\[i \* a\.cols \+ i\];', r're += a.re[i * a.cols + i]!;', 'mTrace re')
sub(r'im \+= a\.im\[i \* a\.cols \+ i\];', r'im += a.im[i * a.cols + i]!;', 'mTrace im')
# kron
sub(r'const ar = a\.re\[i \* a\.cols \+ j\];', r'const ar = a.re[i * a.cols + j]!;', 'kron ar')
sub(r'const ai = a\.im\[i \* a\.cols \+ j\];', r'const ai = a.im[i * a.cols + j]!;', 'kron ai')
sub(r'const br = b\.re\[p \* b\.cols \+ q\];', r'const br = b.re[p * b.cols + q]!;', 'kron br')
sub(r'const bi = b\.im\[p \* b\.cols \+ q\];', r'const bi = b.im[p * b.cols + q]!;', 'kron bi')
sub(r'(m\.re\[ri \* m\.cols \+ ci\]) \+= ar \* br - ai \* bi;', r'\1! += ar * br - ai * bi;', 'kron acc re')
sub(r'(m\.im\[ri \* m\.cols \+ ci\]) \+= ar \* bi \+ ai \* br;', r'\1! += ar * bi + ai * br;', 'kron acc im')
# vKron
sub(r'(v\.re\[i \* b\.n \+ j\]) = a\.re\[i\] \* b\.re\[j\] - a\.im\[i\] \* b\.im\[j\];', r'\1! = a.re[i]! * b.re[j]! - a.im[i]! * b.im[j]!;', 'vKron re')
sub(r'(v\.im\[i \* b\.n \+ j\]) = a\.re\[i\] \* b\.im\[j\] \+ a\.im\[i\] \* b\.re\[j\];', r'\1! = a.re[i]! * b.im[j]! + a.im[i]! * b.re[j]!;', 'vKron im')
# isHermitian
sub(r'const dr = a\.re\[i \* a\.cols \+ j\] - a\.re\[j \* a\.cols \+ i\];', r'const dr = a.re[i * a.cols + j]! - a.re[j * a.cols + i]!;', 'isHermitian dr')
sub(r'const di = a\.im\[i \* a\.cols \+ j\] \+ a\.im\[j \* a\.cols \+ i\];', r'const di = a.im[i * a.cols + j]! + a.im[j * a.cols + i]!;', 'isHermitian di')
# matEq
sub(r'if \(Math\.abs\(a\.re\[k\] - b\.re\[k\]\) > tol \|\| Math\.abs\(a\.im\[k\] - b\.im\[k\]\) > tol\) return false;', r'if (Math.abs(a.re[k]! - b.re[k]!) > tol || Math.abs(a.im[k]! - b.im[k]!) > tol) return false;', 'matEq')
# jacobiRealSymmetric
sub(r's \+= m\[i \* n \+ j\] \* m\[i \* n \+ j\];', r's += m[i * n + j]! * m[i * n + j]!;', 'jacobi offDiag')
sub(r'const apq = m\[p \* n \+ q\];', r'const apq = m[p * n + q]!;', 'jacobi apq')
sub(r'const theta = \(m\[q \* n \+ q\] - m\[p \* n \+ p\]\) / \(2 \* apq\);', r'const theta = (m[q * n + q]! - m[p * n + p]!) / (2 * apq);', 'jacobi theta')
sub(r'colP\[k\] = m\[k \* n \+ p\];', r'colP[k]! = m[k * n + p]!;', 'jacobi colP read')
sub(r'colQ\[k\] = m\[k \* n \+ q\];', r'colQ[k]! = m[k * n + q]!;', 'jacobi colQ read')
sub(r'm\[k \* n \+ p\] = c \* colP\[k\] - s \* colQ\[k\];', r'm[k * n + p]! = c * colP[k]! - s * colQ[k]!;', 'jacobi col write p')
sub(r'm\[k \* n \+ q\] = s \* colP\[k\] \+ c \* colQ\[k\];', r'm[k * n + q]! = s * colP[k]! + c * colQ[k]!;', 'jacobi col write q')
sub(r'rowP\[k\] = m\[p \* n \+ k\];', r'rowP[k]! = m[p * n + k]!;', 'jacobi rowP read')
sub(r'rowQ\[k\] = m\[q \* n \+ k\];', r'rowQ[k]! = m[q * n + k]!;', 'jacobi rowQ read')
sub(r'm\[p \* n \+ k\] = c \* rowP\[k\] - s \* rowQ\[k\];', r'm[p * n + k]! = c * rowP[k]! - s * rowQ[k]!;', 'jacobi row write p')
sub(r'm\[q \* n \+ k\] = s \* rowP\[k\] \+ c \* rowQ\[k\];', r'm[q * n + k]! = s * rowP[k]! + c * rowQ[k]!;', 'jacobi row write q')
sub(r'for \(let i = 0; i < n; i\+\+\) values\[i\] = m\[i \* n \+ i\];', r'for (let i = 0; i < n; i++) values[i]! = m[i * n + i]!;', 'jacobi values')
# solveLinear
sub(r'if \(Math\.abs\(a\[r \* n \+ col\]\) > Math\.abs\(a\[best \* n \+ col\]\)\) best = r;', r'if (Math.abs(a[r * n + col]!) > Math.abs(a[best * n + col]!)) best = r;', 'solve pivot search')
sub(r'if \(Math\.abs\(a\[best \* n \+ col\]\) < 1e-300\) return null;', r'if (Math.abs(a[best * n + col]!) < 1e-300) return null;', 'solve pivot check')
sub(r'const t = a\[col \* n \+ j\];\n(\s+)a\[col \* n \+ j\] = a\[best \* n \+ j\];\n\s+a\[best \* n \+ j\] = t;', r'const t = a[col * n + j]!;\n\1a[col * n + j]! = a[best * n + j]!;\n\1a[best * n + j]! = t;', 'solve swap rows')
sub(r'const t = x\[col\];\n(\s+)x\[col\] = x\[best\];\n\s+x\[best\] = t;', r'const t = x[col]!;\n\1x[col]! = x[best]!;\n\1x[best]! = t;', 'solve swap x')
sub(r'const piv = a\[col \* n \+ col\];', r'const piv = a[col * n + col]!;', 'solve piv')
sub(r'const f = a\[r \* n \+ col\] / piv;', r'const f = a[r * n + col]! / piv;', 'solve f')
sub(r'for \(let j = col; j < n; j\+\+\) a\[r \* n \+ j\] -= f \* a\[col \* n \+ j\];', r'for (let j = col; j < n; j++) a[r * n + j]! -= f * a[col * n + j]!;', 'solve eliminate')
sub(r'x\[r\] -= f \* x\[col\];', r'x[r]! -= f * x[col]!;', 'solve x update')
sub(r'let s = x\[r\];', r'let s = x[r]!;', 'solve backsub init')
sub(r'for \(let j = r \+ 1; j < n; j\+\+\) s -= a\[r \* n \+ j\] \* x\[j\];', r'for (let j = r + 1; j < n; j++) s -= a[r * n + j]! * x[j]!;', 'solve backsub')
sub(r'x\[r\] = s / a\[r \* n \+ r\];', r'x[r]! = s / a[r * n + r]!;', 'solve backsub write')
# orthonormalize
sub(r'for \(let i = 0; i < n; i\+\+\) dot \+= u\[i\] \* v\[i\];', r'for (let i = 0; i < n; i++) dot += u[i]! * v[i]!;', 'orth dot')
sub(r'for \(let i = 0; i < n; i\+\+\) v\[i\] -= dot \* u\[i\];', r'for (let i = 0; i < n; i++) v[i]! -= dot * u[i]!;', 'orth project')
sub(r'for \(let i = 0; i < n; i\+\+\) v\[i\] /= norm;', r'for (let i = 0; i < n; i++) v[i]! /= norm;', 'orth normalize')
# eigVecsFromValues
sub(r'for \(let i = 0; i < n; i\+\+\) v\[i\] = rand\(\) \* 2 - 1;', r'for (let i = 0; i < n; i++) v[i]! = rand() * 2 - 1;', 'eigVecs block fill')
sub_all(r'if \(last && Math\.abs\(values\[i\] - values\[last\[0\]\]\) <= tol\) last\.push\(i\);', r'if (last && Math.abs(values[i]! - values[last[0]!]!) <= tol) last.push(i);', 'cluster tol (both sites)')
sub(r'const lam = values\[cluster\[0\]\];', r'const lam = values[cluster[0]!]!;', 'eigVecs lam')
sub(r'gap = Math\.min\(gap, Math\.abs\(lam - values\[clusters\[cj\]\[0\]\]\)\);', r'gap = Math.min(gap, Math.abs(lam - values[clusters[cj]![0]!]!));', 'eigVecs gap')
sub(r'v\[cluster\[j\] % n\] = 1;', r'v[cluster[j]! % n]! = 1;', 'eigVecs retry basis')
sub(r'for \(let i = 0; i < n; i\+\+\) v\[i\] \+= rand\(\) \* 1e-3;', r'for (let i = 0; i < n; i++) v[i]! += rand() * 1e-3;', 'eigVecs retry fill')
sub(r'for \(let i = 0; i < n; i\+\+\) shifted\[i \* n \+ i\] -= lam \+ eps;', r'for (let i = 0; i < n; i++) shifted[i * n + i]! -= lam + eps;', 'eigVecs shift')
sub(r'out\[cluster\[j\]\] = block\[j\];', r'out[cluster[j]!] = block[j]!;', 'eigVecs out write')
# eigenvaluesHermitian
sub(r'out\[i\] = \(sorted\[2 \* i\] \+ sorted\[2 \* i \+ 1\]\) / 2;', r'out[i]! = (sorted[2 * i]! + sorted[2 * i + 1]!) / 2;', 'eigenvalues pairs')
# eigHermitian cInner
sub(r're \+= u\.re\[i\] \* v\.re\[i\] \+ u\.im\[i\] \* v\.im\[i\];', r're += u.re[i]! * v.re[i]! + u.im[i]! * v.im[i]!;', 'cInner re')
sub(r'im \+= u\.re\[i\] \* v\.im\[i\] - u\.im\[i\] \* v\.re\[i\];', r'im += u.re[i]! * v.im[i]! - u.im[i]! * v.re[i]!;', 'cInner im')
# eigHermitian gram-schmidt
sub(r'v\.re\[k\] -= d\.re \* u\.re\[k\] - d\.im \* u\.im\[k\];', r'v.re[k]! -= d.re * u.re[k]! - d.im * u.im[k]!;', 'gs re')
sub(r'v\.im\[k\] -= d\.re \* u\.im\[k\] \+ d\.im \* u\.re\[k\];', r'v.im[k]! -= d.re * u.im[k]! + d.im * u.re[k]!;', 'gs im')
sub(r'const lam = raw\[cluster\[0\]\];', r'const lam = raw[cluster[0]!]!;', 'eigH lam')
sub(r'let v = decode\(rawVecs\[i\]\);', r'let v = decode(rawVecs[i]!);', 'eigH decode')
# eigHermitian ordering
sub(r'const orderOut = outValues\.map\(\(_, i\) => i\)\.sort\(\(a, b\) => outValues\[a\] - outValues\[b\]\);', r'const orderOut = outValues.map((_, i) => i).sort((a, b) => outValues[a]! - outValues[b]!);', 'orderOut sort')
sub(r'values\[k\] = outValues\[orderOut\[k\]\];', r'values[k]! = outValues[orderOut[k]!]!;', 'values write')
sub(r'vectors\.push\(outVectors\[orderOut\[k\]\]\);', r'vectors.push(outVectors[orderOut[k]!]!);', 'vectors push')
sub(r'err \+= Math\.abs\(recon\.re\[k\] - h\.re\[k\]\) \+ Math\.abs\(recon\.im\[k\] - h\.im\[k\]\);', r'err += Math.abs(recon.re[k]! - h.re[k]!) + Math.abs(recon.im[k]! - h.im[k]!);', 'recon err')
# buildEmbedding
sub(r'const re = h\.re\[i \* n \+ j\];', r'const re = h.re[i * n + j]!;', 'emb re read')
sub(r'const im = h\.im\[i \* n \+ j\];', r'const im = h.im[i * n + j]!;', 'emb im read')
sub(r'emb\[i \* N \+ j\] = re;', r'emb[i * N + j]! = re;', 'emb write 1')
sub(r'emb\[\(i \+ n\) \* N \+ \(j \+ n\)\] = re;', r'emb[(i + n) * N + (j + n)]! = re;', 'emb write 2')
sub(r'emb\[i \* N \+ \(j \+ n\)\] = -im;', r'emb[i * N + (j + n)]! = -im;', 'emb write 3')
sub(r'emb\[\(i \+ n\) \* N \+ j\] = im;', r'emb[(i + n) * N + j]! = im;', 'emb write 4')
# colFrom
sub(r'm\.re\[i\] = re\[i\];', r'm.re[i]! = re[i]!;', 'colFrom re')
sub(r'm\.im\[i\] = im\[i\];', r'm.im[i]! = im[i]!;', 'colFrom im')
# reconstruct
sub(r'const lam = values\[m\];\n(\s+)if \(lam <= 0\) continue;\n\s+const vk = vectors\[m\];', r'const lam = values[m]!;\n\1if (lam <= 0) continue;\n\1const vk = vectors[m]!;', 'reconstruct lam/vk')
sub(r'out\.re\[i \* n \+ j\] \+= lam \* \(vk\.re\[i\] \* vk\.re\[j\] \+ vk\.im\[i\] \* vk\.im\[j\]\);', r'out.re[i * n + j]! += lam * (vk.re[i]! * vk.re[j]! + vk.im[i]! * vk.im[j]!);', 'reconstruct re')
sub(r'out\.im\[i \* n \+ j\] \+= lam \* \(vk\.im\[i\] \* vk\.re\[j\] - vk\.re\[i\] \* vk\.im\[j\]\);', r'out.im[i * n + j]! += lam * (vk.im[i]! * vk.re[j]! - vk.re[i]! * vk.im[j]!);', 'reconstruct im')
# sqrtPSD
sub(r'const lam = Math\.max\(0, values\[k\]\);\n(\s+)if \(lam === 0\) continue;\n\s+const s = Math\.sqrt\(lam\);\n\s+const vk = vectors\[k\];', r'const lam = Math.max(0, values[k]!);\n\1if (lam === 0) continue;\n\1const s = Math.sqrt(lam);\n\1const vk = vectors[k]!;', 'sqrtPSD lam/vk')
sub(r'out\.re\[i \* n \+ j\] \+= s \* \(vk\.re\[i\] \* vk\.re\[j\] \+ vk\.im\[i\] \* vk\.im\[j\]\);', r'out.re[i * n + j]! += s * (vk.re[i]! * vk.re[j]! + vk.im[i]! * vk.im[j]!);', 'sqrtPSD re')
sub(r'out\.im\[i \* n \+ j\] \+= s \* \(vk\.im\[i\] \* vk\.re\[j\] - vk\.re\[i\] \* vk\.im\[j\]\);', r'out.im[i * n + j]! += s * (vk.im[i]! * vk.re[j]! - vk.re[i]! * vk.im[j]!);', 'sqrtPSD im')
# fromSpectral
sub(r'const vk = vectors\[k\];', r'const vk = vectors[k]!;', 'fromSpectral vk')
sub(r'out\.re\[i \* n \+ j\] \+= values\[k\] \* \(vk\.re\[i\] \* vk\.re\[j\] \+ vk\.im\[i\] \* vk\.im\[j\]\);', r'out.re[i * n + j]! += values[k]! * (vk.re[i]! * vk.re[j]! + vk.im[i]! * vk.im[j]!);', 'fromSpectral re')
sub(r'out\.im\[i \* n \+ j\] \+= values\[k\] \* \(vk\.im\[i\] \* vk\.re\[j\] - vk\.re\[i\] \* vk\.im\[j\]\);', r'out.im[i * n + j]! += values[k]! * (vk.im[i]! * vk.re[j]! - vk.re[i]! * vk.im[j]!);', 'fromSpectral im')

with open(path, 'w') as f:
    f.write(src)

misses = [n for s, n in applied if s == 'MISS']
print(f'{len(applied)} rules applied, misses: {misses}')
