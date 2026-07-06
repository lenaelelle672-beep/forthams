Edit this candidate into a new persistent Stitch DESIGN/HTML screen using the IMAGE2 v2 source screenshot as the only source of truth.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `system-params-subpage-03-file-storage-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 文件存储与缩略图配置台
Menu id: system-file-storage
Reference image: system-params-subpage-03-file-storage-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-03-file-storage-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-file-storage
Canvas: exactly 1595 x 986 CSS pixels.

Keep the current candidate's good overall structure, but repair only the mismatches below against the IMAGE2 source:

1. Brand and shell:
   - Preserve the exact source top-left brand: `UNIVIEW` with cyan `VIEW`, divider, `固定资产管理系统`.
   - Do not split UNIVIEW into `UNI` / `VIEW`.
   - Do not add emoji or generic pictograph icons.
   - Keep the source navigation: `资产管理`, `盘点管理`, `采购管理`, `运维管理`, `报表中心`, active `系统运营中枢`, `系统设置`.

2. Right editor punctuation must match the source exactly with full-width Chinese punctuation:
   - `对象存储（OSS）- 阿里云`
   - `缩略图生成策略（THUMBNAIL_POLICY）`
   - `启用（病毒扫描 + 敏感内容识别）`
   - `回退到本地临时存储（7 天）`
   Do not output ASCII parentheses for these four values.

3. Bottom row must fit inside the 986px viewport:
   - Bottom cards start around y=618 and end around y=925, like the source.
   - Card height about 300px, not 410px.
   - All bottom links must be visible above the viewport bottom:
     `查看全部队列`, `查看更多格式配置`, `查看失败明细`.
   - The last rows in `缩略图队列`, `预览格式与安全扫描`, and `归档与失败回退` must be visible without vertical scrollbars.

4. Keep the middle row compact and visible:
   - Left table shows five rows through `安全扫描规则`.
   - Right editor shows all eight rows through `失败回退` and the three buttons `保存草稿`, `提交校验`, `测试连接`.
   - No source-visible content may be hidden by `overflow-y-auto`, `overflow-auto`, or clipping.

Required visible text:
- `文件存储与缩略图配置台`
- `文件存储策略列表`
- `文件存储策略编排`
- `资产附件主桶`, `CIP 验收附件归档桶`, `缩略图生成策略`, `Office 预览策略`, `安全扫描规则`
- `对象存储（OSS）- 阿里云`
- `缩略图生成策略（THUMBNAIL_POLICY）`
- `启用（病毒扫描 + 敏感内容识别）`
- `回退到本地临时存储（7 天）`
- `存储拓扑`, `缩略图队列`, `预览格式与安全扫描`, `归档与失败回退`
- `查看全部队列`, `查看更多格式配置`, `查看失败明细`

Forbidden failure modes:
- `UNI VIEW` split branding.
- ASCII punctuation variants: `对象存储 (OSS) - 阿里云`, `缩略图生成策略 (THUMBNAIL_POLICY)`, `启用 (病毒扫描 + 敏感内容识别)`, `回退到本地临时存储 (7 天)`.
- Bottom card links below y=986 or requiring scroll.
- Emoji/generic icons.

Final self-check:
- Headless browser screenshot at 1595 x 986 shows no page scroll and no clipped bottom card links.
- All four required full-width punctuation values are visible.
- Bottom row visually matches the IMAGE2 source height and spacing.
