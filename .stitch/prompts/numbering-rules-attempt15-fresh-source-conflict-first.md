Edit the selected uploaded IMAGE2 v2 screenshot into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded screenshot `master-data-subpage-02-numbering-rules-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 资产编号规则配置台
Menu id: system-numbering-rules
Reference image: master-data-subpage-02-numbering-rules-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/master-data-subpage-02-numbering-rules-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-numbering-rules
Canvas: exactly 1586 x 992 CSS pixels.

Build directly from the uploaded IMAGE screen. Do not use any prior generated candidate as the visual source.

Frame and shell:
- Fixed viewport/canvas 1586 x 992.
- No page-level scroll and no internal vertical scrollbars for source-visible content.
- Top dark navy shell y=0..50 with the source-visible UNIVIEW brand lockup and active top tab `系统运营中枢`.
- Left white system sidebar x=0..206 y=51..992. `基础资料` is expanded and `编号规则` is active.
- Main content x=206..1586 y=51..992.

Vertical source bands:
- Header/title/action band y=65..126.
- Green/orange status strip y=128..168.
- Filter row y=178..224.
- Work area y=232..960.

Main work area:
- Left rule list card x=226..438 y=232..760. It must show seven rule list rows:
  `小类+年月+公共月序列`, `CIP转固编号`, `IT设备编号`, `备件编码`, `临时资产编号`, `服务器编号`, `笔记本编号`.
- Left footer `共 7 条` and button `展开全部` visible above y=960.
- Center main card x=450..1208 y=232..960.
- Right editor rail x=1218..1576 y=232..960.

Center card required geometry:
- `编号规则明细表` table y=232..525. The table must show six compact horizontal rows, no vertical text, no wrapped stacked cells.
- Table columns: `规则名称`, `规则编码`, `业务对象`, `编号模式`, `序列口径`, `数量折行`, `占号策略`, `状态`, `操作`.
- Use exact source wording `数量折行`, not `数量拆行`.
- Visible rows must include:
  `小类+年月+公共月序列`, `CIP转固公共月序列`, `IT设备编号`, `服务器编号`, `备件编码`, `临时资产编号`.
- `编号试算预览` y=535..790. Keep the three source blocks visible in one row: `输入样本`, arrow, `试算结果（分行后效果）`, `规则预览说明`.
- The result table must show generated numbers:
  `SESMT2026060001`, `SESMT2026060002`, `SESMT2026060003`, `SESMT2026060004`, `CIP2026060005`, `CIP2026060006`.
- `冲突检测队列（共 1 项待处理）` y=800..952. It must show all four rows:
  `历史锁号重复`, `手工改号冲突`, `资产小类缺失`, `已核销批次只读`.

Right editor required geometry:
- `编号规则属性编辑区` y=232..723.
- Use compact 28px controls and tight field rows so all source-visible fields are inside the panel:
  `规则名称`, `规则编码`, `业务对象`, `编号模式`, `序列口径`, `年月格式`, `序列位数`, `数量折行`, `预览是否占号`, `生成占号策略`, `冲突处理`, `回滚方案`, `审计策略`, `负责人`.
- Buttons `保存草稿`, `提交校验`, `试算编号` must be visible at the bottom of the editor panel.
- `发布门禁 / 回滚策略` y=733..952. It must show all six checklist rows plus the orange warning:
  `编码唯一性`, `序列口径确认`, `数量折行已配置`, `试算样本通过`, `冲突队列已处理`, `回滚方案已编写`.
- Orange warning text: `已生成资产保留旧编号，新规则仅影响发布后批次。`

Required exact text:
- `资产编号规则配置台`
- `新建编号规则`, `试算编号`, `冲突检测`, `保存草稿`, `提交校验`
- `当前草稿已保存`, `试算样本 3 条`, `冲突检测 1 项待处理`
- `编号规则列表`, `编号规则明细表`, `编号试算预览`, `冲突检测队列（共 1 项待处理）`
- `编号规则属性编辑区`, `发布门禁 / 回滚策略`
- `小类+年月+公共月序列`, `R-CLS-YM-MSEQ`, `CIP转固公共月序列`, `R-CIP-MSEQ`
- `数量折行`, `序列位数`, `预览不占号`
- `SESMT2026060006`, `CIP2026060006`
- `历史锁号重复`, `手工改号冲突`, `资产小类缺失`, `已核销批次只读`
- `数量折行已配置`, `试算样本通过`, `回滚方案已编写`

Forbidden exact strings:
- `数量拆行`
- `序位位数`
- `预留不占号`
- `历史号重复`
- lowercase generic `uniview` without the source lockup

Density rules:
- Use table rows about 34px high.
- Use 11px to 12px text in dense tables.
- Use `white-space: nowrap` behavior visually: Chinese table cells must be horizontal, not vertical stacks.
- Do not hide any source-visible row behind scroll, clipped panels, or overflow containers.
- If space is tight, reduce padding and editor body heights. Do not remove required source-visible rows.

Final self-check:
- At a real 1586 x 992 browser viewport, document width and height remain exactly 1586 x 992.
- The center table, preview, conflict queue, right editor, and right publish gate are all visible simultaneously.
- The screenshot looks like the uploaded IMAGE2 source, not a generic admin page.
