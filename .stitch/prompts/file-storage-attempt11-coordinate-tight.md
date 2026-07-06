Edit the selected uploaded IMAGE2 v2 screenshot screen into a new DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 文件存储与缩略图配置台
Menu id: system-file-storage
Reference image: system-params-subpage-03-file-storage-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-03-file-storage-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-file-storage

Preserve the exact top-left IMAGE2 brand mark for this source: white UNIVIEW with teal letters exactly as shown, the divider, and the adjacent subtitle 固定资产管理系统. Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.

Canvas and no-scroll contract:
- The HTML viewport must be exactly 1595 x 986 CSS pixels.
- The body and document must be exactly 1595 x 986. No document scroll.
- No component may require vertical scrolling to see source-visible content.
- Do not generate a doubled 3190 x 2048 layout. Use the source CSS coordinate system, 1595 x 986.

Exact source geometry:
- Top shell: x=0 y=0 w=1595 h=52, dark navy.
- Sidebar: x=0 y=52 w=206 h=557, dark gradient. Active item: 文件存储配置 at y about 349, teal strip and teal fill.
- Content root: x=206 y=52 w=1389 h=934, light gray background.
- Page header: title at x=238 y=72, action buttons at x=1105 y=72. Keep title 文件存储与缩略图配置台 and subtitle 附件、缩略图、对象存储、本地存储、归档与安全扫描配置。
- KPI row: y=132 to 230, four equal cards with source icons and values 8, 2, 4, 3.
- Middle row: y=242 to 606, left table card x=219 w=746, right editor card x=979 w=600. Bottom of both cards must be <=606.
- Bottom row: y=618 to 925, four cards, each h about 300. Bottom of every card and footer link must be <=925. Do not place any bottom card at y=656 or height 410.

Middle left card:
- Title: 文件存储策略列表.
- Search placeholder: 搜索存储策略 / 桶名 / 模块.
- Filters exactly: 文件范围 全部, 状态 全部, 风险 全部.
- Table must show all five rows in the visible area with compact row height and no vertical text:
  1. 资产附件主桶, ASSET_MAIN_BUCKET, 资产附件, oss://uniview-asset-main, 低, 启用, 编辑 测试 ...
  2. CIP 验收附件归档桶, CIP_ARCHIVE_BUCKET, CIP 验收附件, oss://uniview-cip-archive, 中, 启用, 编辑 测试 ...
  3. 缩略图生成策略, THUMBNAIL_POLICY, 缩略图, oss://uniview-thumb, 低, 启用, 编辑 测试 ...
  4. Office 预览策略, OFFICE_PREVIEW_POLICY, 预览文件, oss://uniview-preview, 中, 启用, 编辑 测试 ...
  5. 安全扫描规则, SEC_SCAN_POLICY, 全部文件, local://sec-scan-temp, 高, 启用, 编辑 测试 ...
- Footer visible at the card bottom: 共 5 条, page 1, 10 条/页.

Middle right card:
- Title must be 文件存储策略编排 if that is what the screenshot shows. Do not change it to 编辑.
- Progress text: 完成度 8/8.
- The eight source rows must all be fully visible in the card with no clipping and no internal scroll:
  1. 存储后端: 对象存储（OSS）- 阿里云
  2. 附件目录: uniview-asset-main/attachments/
  3. 缩略图策略: 缩略图生成策略（THUMBNAIL_POLICY）
  4. 预览格式: PDF, DOCX, XLSX, PPTX, TXT, JPG, PNG
  5. 归档生命周期: 转归档：30 天后, 删除：730 天后
  6. 访问权限: 私有读写（签名访问 15 分钟）
  7. 安全检查: 启用（病毒扫描 + 敏感内容识别）
  8. 失败回退: 回退到本地临时存储（7 天）
- Use full-width Chinese parentheses and punctuation exactly: （OSS）, （THUMBNAIL_POLICY）, （病毒扫描 + 敏感内容识别）, （7 天）, 转归档：30 天后, 删除：730 天后.
- Buttons inside the card bottom, fully visible: 保存草稿, 提交校验, 测试连接.

Bottom four cards:
- Card 1 title 存储拓扑. Show the same topology nodes, arrows, labels and legend. Footer/legend must remain visible above y=925.
- Card 2 title 缩略图队列. Show tabs 处理中（3）, 等待中（1）, 失败（0） and rows IMG_20240520_001.jpg, diagram_v2.png, 设备铭牌.jpg, plan_floor3.dwg. Footer link: 查看全部队列.
- Card 3 title 预览格式与安全扫描. Show tabs 预览格式支持, 安全扫描趋势 and rows PDF, DOCX, XLSX, PPTX, DWG, EXE. Footer link: 查看更多格式配置.
- Card 4 title 归档与失败回退. Show 默认归档策略, 30, 730, 启用, 回退到本地临时存储, 回退到备用桶, 写入失败 and trend sparklines. Footer link: 查看失败明细.

Critical fixes learned from failed candidates:
- Do not put bottom card footers at y=1032. All bottom links must be visible in the 986px frame.
- Do not make bottom cards 410px tall. They are about 300px tall in the source.
- Do not hide the last right-editor fields behind overflow hidden.
- Do not replace full-width Chinese punctuation with ASCII parentheses.
- Do not introduce a generic dark admin template or changed nav grouping.
