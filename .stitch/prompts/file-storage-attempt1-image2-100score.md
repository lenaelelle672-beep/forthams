Edit the selected uploaded IMAGE2 v2 product screenshot into a 100/100 pixel-fidelity HTML transcription.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Project: 1232247032869317081
Page name: 文件存储配置
Menu id: system-file-storage
Reference image: system-params-subpage-03-file-storage-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-03-file-storage-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-file-storage
Viewport: exactly 1595 x 986. No page-level scroll. No hidden required rows.

Critical brand and icon rules:
- Preserve the exact top-left IMAGE2 brand mark for this source: white/teal `UNIVIEW`, adjacent `固定资产管理系统`, and source-visible spacing.
- Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
- Do not use emoji glyphs anywhere. Header buttons and cards must use source-like line icons or simple vector/icon-font shapes, never emoji.
- Keep the source teal primary color for this page, not the blue generic admin template unless the source uses blue.

Shell and navigation:
- Dark navy top shell with active top module `系统运营中枢`; top nav labels include `资产管理`, `盘点管理`, `采购管理`, `运维管理`, `报表中心`, `系统运营中枢`, `系统设置`.
- Left sidebar top label: `系统设置`.
- Active section: `系统参数`.
- Active menu item: `文件存储配置`.
- Visible left labels include: 组织与权限, 基础数据, 系统参数, 基础参数, 业务参数, 存储参数, 文件存储配置, 安全扫描配置, 通知配置, 集成配置, 系统日志, 审计日志.

Header:
- Title: `文件存储与缩略图配置台`.
- Subtitle: `附件、缩略图、对象存储、本地存储、归档与安全扫描一盘配置。`
- Right actions in order: `新建存储策略`, `保存草稿`, `提交校验`, `测试连接`.

KPI row:
- Four cards in one row:
  1. `存储策略`, value `8`, subtext `已启用 6 个，停用 2 个`.
  2. `待测试`, value `2`, subtext `2 个策略上次测试失败`.
  3. `缩略图队列`, value `4`, subtext `处理中 3，等待 1`.
  4. `归档桶`, value `3`, subtext `生命周期策略已启用`.

Upper left card: `文件存储策略列表`
- Filters: search placeholder `搜索存储策略 / 桶名 / 模块`; `文件范围` select `全部`; `状态` select `全部`; `风险` select `全部`; a refresh icon at the right.
- Table header columns: `策略名称`, `策略键`, `文件范围`, `存储值`, `风险等级`, `状态`, `操作`.
- Must show exactly 5 body rows:
  1. `资产附件主桶`, `ASSET_MAIN_BUCKET`, `资产附件`, `oss://uniview-asset-main`, `低`, `启用`, `编辑`, `测试`, `...`.
  2. `CIP 验收附件归档桶`, `CIP_ARCHIVE_BUCKET`, `CIP 验收附件`, `oss://uniview-cip-archive`, `中`, `启用`, `编辑`, `测试`, `...`.
  3. `缩略图生成策略`, `THUMBNAIL_POLICY`, `缩略图`, `oss://uniview-thumb`, `低`, `启用`, `编辑`, `测试`, `...`.
  4. `Office 预览策略`, `OFFICE_PREVIEW_POLICY`, `预览文件`, `oss://uniview-preview`, `中`, `启用`, `编辑`, `测试`, `...`.
  5. `安全扫描规则`, `SEC_SCAN_POLICY`, `全部文件`, `local://sec-scan-temp`, `高`, `启用`, `编辑`, `测试`, `...`.
- Pagination visible: `共 5 条`, page `1`, `10 条/页`.
- Do not wrap table columns into vertical text. The table must fit the card without horizontal scroll.

Upper right card: `文件存储策略编辑`
- Top right progress: `完成度 8/8` with a teal horizontal bar.
- All 8 rows visible with green validation icons on the far right:
  - `存储后端`: `对象存储（OSS）- 阿里云`
  - `附件目录`: `uniview-asset-main/attachments/`
  - `缩略图策略`: `缩略图生成策略（THUMBNAIL_POLICY）`
  - `预览格式`: `PDF, DOCX, XLSX, PPTX, TXT_JPG, PNG`
  - `归档生命周期`: `转归档：30 天后，删除：730 天后`
  - `访问权限`: `私有读写（签名访问 15 分钟）`
  - `安全检查`: `启用（病毒扫描 + 敏感内容识别）`
  - `失败回退`: `回退到本地临时存储（7 天）`
- Bottom actions in this card: `保存草稿`, `提交校验`, `测试连接`.

Bottom row cards:
1. `存储拓扑`
   - Show left node `应用服务集群 2 节点`, connected by solid/dashed routes to `对象存储（OSS）`, `本地临时存储`, `归档存储（OSS）`.
   - Include status text `正常` and legend `主路径`, `回退路径`, `连接正常`, `连接异常`.
2. `缩略图队列`
   - Include tabs `处理中（3）`, `等待中（1）`, `失败（0）`.
   - Table rows visible: `IMG_20240520_001.jpg` 78% 处理中 00:00:18; `diagram_v2.png` 45% 处理中 00:00:31; `设备铭牌.jpg` 12% 处理中 00:00:07; `plan_floor3.dwg` 等待中.
   - Footer link: `查看全部队列`.
3. `预览格式与安全扫描`
   - Include tabs `预览格式支持`, `安全扫描趋势`.
   - Table rows: `PDF`, `DOCX`, `XLSX`, `PPTX`, `DWG`, `EXE` with source-like support/security status dots and descriptions.
   - Footer link: `查看更多格式配置`.
4. `归档与失败回退`
   - Include `归档策略` table: `默认归档策略`, `30`, `730`, `启用`.
   - Include `失败回退统计（近 7 天）` rows: `回退到本地临时存储`, `回退到备用桶`, `写入失败`, with small sparkline shapes.
   - Footer link: `查看失败明细`.

Final self-check before completion:
- The rendered page at 1595 x 986 has no document scroll.
- The two upper cards and four bottom cards align exactly like the source.
- All 5 table rows, all 8 editor rows, and all 4 bottom cards are visible.
- No emoji glyph appears anywhere.
- The result looks like the uploaded source screenshot, not a generic admin dashboard.
