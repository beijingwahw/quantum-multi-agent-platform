# -*- coding: utf-8 -*-
"""手写签名照片 → 透明背景 PNG（基于 ASCII 布局诊断的固定窗口提取）
窗口依据：36×72 墨迹密度图显示签名笔画位于 y≈90-1300 / x≈1350-2050，
左下角暗影楔块与顶部边角杂质均在窗口外。
"""
import os
import numpy as np
from PIL import Image, ImageFilter

SRC = os.path.join('D:', os.sep, 'Data', 'Downloads', 'IMG_20260903_062232[1].jpg')
OUT_DIR = os.path.join('D:', os.sep, 'multi-agent', '.formwork', 'work', 'word', 'media')
PREVIEW = os.path.join('D:', os.sep, 'Data', 'Downloads', '\u7b7e\u540d', '\u7b7e\u540d-\u624b\u5199.png')

os.makedirs(OUT_DIR, exist_ok=True)
with Image.open(SRC) as src_img:
    img = src_img.convert('L')
gray = np.asarray(img).astype(np.float32)

# ---- 签名窗口（细粒度布局诊断：竖排签名 y≈1480-2700 / x≈1460-2115，
#      左下暗影楔块 y>3130 才开始，完全在窗口外） ----
Y0, Y1, X0, X1 = 1460, 2720, 1430, 2150
win = gray[Y0:Y1, X0:X1]

# ---- 自适应阈值：以窗口内纸面亮度（中位数）为基准 ----
paper_level = float(np.median(win))
high = paper_level - 8    # 略暗于纸面即开始半透明
low = paper_level - 52    # 明显暗于纸面为全墨
alpha = np.clip((high - win) / (high - low), 0.0, 1.0)
alpha_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
alpha = np.asarray(alpha_img).astype(np.float32) / 255.0
print(f'\u7eb8\u9762\u4eae\u5ea6={paper_level:.0f}, \u58a8\u8ff9\u9608\u503c [{low:.0f},{high:.0f}]')

# ---- 裁剪到笔迹包围盒 ----
ys, xs = np.where(alpha > 0.30)
assert len(ys) > 500, '\u7a97\u53e3\u5185\u672a\u68c0\u51fa\u7b14\u8ff9'
y0, y1 = max(0, ys.min() - 15), min(alpha.shape[0], ys.max() + 15)
x0, x1 = max(0, xs.min() - 15), min(alpha.shape[1], xs.max() + 15)
a = alpha[y0:y1, x0:x1]
print(f'\u7b7e\u540d\u7a97\u53e3\u5185\u5305\u56f4\u76d2: {x1-x0}x{y1-y0} (\u5bbd\u9ad8\u6bd4 {(x1-x0)/(y1-y0):.2f})')

h, w = a.shape
if w > 1400:
    nh = int(h * 1400 / w)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((1400, nh), Image.LANCZOS)).astype(np.float32) / 255.0

rgba = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8)
rgba[..., 0:3] = 28
rgba[..., 3] = (a * 255).astype(np.uint8)
out = Image.fromarray(rgba)
out.save(os.path.join(OUT_DIR, 'signature.png'))
os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
out.save(PREVIEW)
print('\u7b7e\u540dPNG:', out.size, '-> signature.png')
