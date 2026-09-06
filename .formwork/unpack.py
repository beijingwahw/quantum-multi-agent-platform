# -*- coding: utf-8 -*-
"""解包申请书 docx 到 work/ 并检查目标单元格结构（行0/行9/行7）"""
import os
import re
import shutil
import zipfile

SRC = os.path.join('D:', os.sep, 'Data', 'Downloads', '\u201c\u672c\u6e90\u609f\u7a7a\u201d\u79d1\u7814\u6fc0\u52b1\u8ba1\u5212\u7533\u8bf7\u4e66.docx')
WORK = os.path.join('D:', os.sep, 'multi-agent', '.formwork', 'work')

if os.path.exists(WORK):
    shutil.rmtree(WORK)
os.makedirs(WORK)
with zipfile.ZipFile(SRC) as z:
    z.extractall(WORK)
print('extracted to', WORK)

with open(os.path.join(WORK, 'word', 'document.xml'), encoding='utf-8') as f:
    xml = f.read()
rows = re.findall(r'<w:tr[ >].*?</w:tr>', xml, re.S)

def cells(row_xml: str) -> list:
    """取行 XML 中全部单元格（<w:tc>；[ >] 避免误匹配 <w:tcPr>）"""
    return re.findall(r'<w:tc[ >].*?</w:tc>', row_xml, re.S)

print('=== 行0 姓名-值单元格 ===')
print(cells(rows[0])[1][:500])
print()
print('=== 行9 大文本单元格（前900字符）===')
print(cells(rows[9])[0][:900])
print()
print('=== 行7 项目类别单元格全文 ===')
print(cells(rows[7])[1])
