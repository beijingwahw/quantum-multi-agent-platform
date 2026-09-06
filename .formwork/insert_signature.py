# -*- coding: utf-8 -*-
"""将手写签名 PNG 以内联图片嵌入申请书签名处（签名： 之后）

一次性补丁：注册 png Content-Type 与图片关系，把签名图片插入
签名行，然后重新打包为 docx（目标被占用时回退“-定稿”文件名）。
"""
import os
import re
import zipfile
from PIL import Image

WORK = os.path.join('D:', os.sep, 'multi-agent', '.formwork', 'work')
OUT = os.path.join('D:', os.sep, 'Data', 'Downloads',
                   '\u201c\u672c\u6e90\u609f\u7a7a\u201d\u79d1\u7814\u6fc0\u52b1\u8ba1\u5212\u7533\u8bf7\u4e66-\u859b\u56fd\u8f69.docx')
OUT_FALLBACK = OUT.replace('.docx', '-\u5b9a\u7a3f.docx')

SIG = os.path.join(WORK, 'word', 'media', 'signature.png')
REL = os.path.join(WORK, 'word', '_rels', 'document.xml.rels')
CT = os.path.join(WORK, '[Content_Types].xml')
DOC = os.path.join(WORK, 'word', 'document.xml')

assert os.path.exists(SIG), '\u7b7e\u540d PNG \u4e0d\u5b58\u5728\uff0c\u5148\u8fd0\u884c make_signature.py'

# ---- 1) Content_Types \u6ce8\u518c png ----
with open(CT, encoding='utf-8') as f:
    ct = f.read()
if 'Extension="png"' not in ct:
    ct = ct.replace('<Default Extension="rels"',
                    '<Default Extension="png" ContentType="image/png"/><Default Extension="rels"')
    with open(CT, 'w', encoding='utf-8') as f:
        f.write(ct)

# ---- 2) \u5173\u7cfb\uff1a\u65b0\u589e rIdSig -> media/signature.png ----
with open(REL, encoding='utf-8') as f:
    rels = f.read()
m_rid = re.search(r'Id="(rId\d+)"[^>]*Target="media/signature\.png"', rels)
if m_rid:
    # \u5df2\u6ce8\u518c\u8fc7\uff08\u91cd\u590d\u8fd0\u884c\u65f6\u590d\u7528\uff0c\u907f\u514d\u4ea7\u751f\u91cd\u590d\u5173\u7cfb\uff09
    rid = m_rid.group(1)
else:
    existing = re.findall(r'Id="(rId\d+)"', rels)
    next_num = max((int(r[3:]) for r in existing), default=0) + 1
    rid = f'rId{next_num}'
    rels = rels.replace('</Relationships>',
        f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/></Relationships>')
    with open(REL, 'w', encoding='utf-8') as f:
        f.write(rels)
print('\u56fe\u7247\u5173\u7cfb:', rid)

# ---- 3) \u5c3a\u5bf8\uff1a\u7b7e\u540d\u9ad8\u7ea6 1.35cm\uff0c\u5bbd\u7b49\u6bd4\uff08EMU: 1cm=360000\uff09 ----
with Image.open(SIG) as sig_img:
    w_px, h_px = sig_img.size
height_cm = 1.35
width_cm = height_cm * w_px / h_px
cx, cy = int(width_cm * 360000), int(height_cm * 360000)
print(f'\u5d4c\u5165\u5c3a\u5bf8: {width_cm:.2f} x {height_cm:.2f} cm')

drawing = (
    '<w:r><w:rPr><w:rFonts w:hint="eastAsia"/></w:rPr><w:drawing>'
    '<wp:inline distT="0" distB="0" distL="0" distR="0">'
    f'<wp:extent cx="{cx}" cy="{cy}"/>'
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
    f'<wp:docPr id="9001" name="handwritten-signature"/>'
    '<wp:cNvGraphicFramePr>'
    '<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>'
    '</wp:cNvGraphicFramePr>'
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    '<pic:nvPicPr><pic:cNvPr id="9001" name="signature"/><pic:cNvPicPr/></pic:nvPicPr>'
    f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/>'
    f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
    '</pic:pic></a:graphicData></a:graphic>'
    '</wp:inline></w:drawing></w:r>'
)

# ---- 4) \u63d2\u5165\u5230\u7b7e\u540d\u884c\uff1a\u7d27\u8ddf "\u7b7e\u540d\uff1a" run \u4e4b\u540e ----
with open(DOC, encoding='utf-8') as f:
    xml = f.read()
rows = re.findall(r'<w:tr[ >].*?</w:tr>', xml, re.S)
cell = re.findall(r'<w:tc[ >].*?</w:tc>', rows[21], re.S)[0]
m = re.search(r'(<w:t xml:space="preserve">[^<]*\u7b7e\u540d\uff1a[^<]*</w:t></w:r>)', cell)
assert m, '\u672a\u627e\u5230\u7b7e\u540d\uff1a \u6587\u672c run'
if f'r:embed="{rid}"' not in cell:
    # \u5df2\u5d4c\u5165\u8fc7\uff08\u91cd\u590d\u8fd0\u884c\uff09\u65f6\u8df3\u8fc7\uff0c\u907f\u514d\u53e0\u52a0\u4e24\u5f20\u7b7e\u540d\u56fe
    patched = cell[:m.end()] + drawing + cell[m.end():]
    xml = xml.replace(cell, patched, 1)
    with open(DOC, 'w', encoding='utf-8') as f:
        f.write(xml)
    print('\u5df2\u63d2\u5165\u7b7e\u540d\u56fe\u7247')
else:
    print('\u7b7e\u540d\u56fe\u7247\u5df2\u5b58\u5728\uff0c\u8df3\u8fc7\u63d2\u5165')

# ---- 5) \u6253\u5305 ----
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
                raise RuntimeError(f'\u6b63\u5f0f\u4e0e\u5b9a\u7a3f\u6587\u4ef6\u5747\u88ab\u5360\u7528\uff0c\u8bf7\u5148\u5173\u95ed Word: {target}')
        print('\u539f\u6587\u4ef6\u88ab\u5360\u7528\uff0c\u5199\u5165\u5b9a\u7a3f\u6587\u4ef6')
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(WORK):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, WORK))
print('OK ->', target)
