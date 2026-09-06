# -*- coding: utf-8 -*-
"""在签名行填入日期：2026 年 9 月 3 日（今天）

一次性补丁：定位 work/word/document.xml 签名行（行 21）的
“年 月 日”占位 run 并替换为具体日期，然后重新打包为 docx。
目标文件被 Word 占用时回退写入 “-定稿.docx”。
"""
import os
import re
import zipfile

WORK = os.path.join('D:', os.sep, 'multi-agent', '.formwork', 'work')
OUT = os.path.join('D:', os.sep, 'Data', 'Downloads',
                   '\u201c\u672c\u6e90\u609f\u7a7a\u201d\u79d1\u7814\u6fc0\u52b1\u8ba1\u5212\u7533\u8bf7\u4e66-\u859b\u56fd\u8f69.docx')
OUT_FALLBACK = OUT.replace('.docx', '-\u5b9a\u7a3f.docx')

DOC = os.path.join(WORK, 'word', 'document.xml')
with open(DOC, encoding='utf-8') as f:
    xml = f.read()

rows = re.findall(r'<w:tr[ >].*?</w:tr>', xml, re.S)
cells = re.findall(r'<w:tc[ >].*?</w:tc>', rows[21], re.S)
cell = cells[0]

# 定位 "年   月   日" 占位文本所在 run（含前导空格）
m = re.search(r'(<w:t xml:space="preserve">)(\s+)(\u5e74\s+\u6708\s+\u65e5)(</w:t>)', cell)
assert m, '\u672a\u627e\u5230\u65e5\u671f\u5360\u4f4d\u6587\u672c'
new_run = m.group(1) + '                                  2026 年 9 月 3 日' + m.group(4)
patched = cell[:m.start()] + new_run + cell[m.end():]
xml = xml.replace(cell, patched, 1)

with open(DOC, 'w', encoding='utf-8') as f:
    f.write(xml)

# 打包（锁定时回退到定稿文件名）
def pick_target() -> str:
    """选择可写的目标路径：正式文件被占用时回退到定稿文件名"""
    target = OUT
    if os.path.exists(OUT):
        try:
            os.remove(OUT)
        except PermissionError:
            target = OUT_FALLBACK
            if os.path.exists(target):
                try:
                    os.remove(target)
                except PermissionError:
                    raise RuntimeError(f'正式与定稿文件均被占用，请先关闭 Word: {target}')
            print('\u6b63\u5f0f\u6587\u4ef6\u88ab\u5360\u7528\uff08\u8bf7\u5173\u95ed Word\uff09\uff0c\u5199\u5165\u5b9a\u7a3f\u6587\u4ef6')
    return target

target = pick_target()
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(WORK):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, WORK))
print('OK ->', target)
