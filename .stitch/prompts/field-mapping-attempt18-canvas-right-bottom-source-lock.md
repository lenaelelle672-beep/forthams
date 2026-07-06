Edit the selected Stitch DESIGN screen into a new persistent HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `integration-subpage-03-field-mapping-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and the adjacent `固定资产管理系统` subtitle.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.

Page name: 字段映射
Menu id: `system-field-mapping`
Reference image: `integration-subpage-03-field-mapping-v2.png`
Reference URL: `http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/integration-subpage-03-field-mapping-v2.png`
Workbench URL: `http://127.0.0.1:5173/fixed-assets/workbench?menu=system-field-mapping`
Canvas: exactly 1586 x 992 CSS pixels.

Repair the visible mismatches from the current candidate:

1. Mapping canvas must match the IMAGE2 source, not horizontal admin-template lines.
   - Keep the `映射关系画布` card at the source position between the left mapping table and right editor.
   - Left nodes: `asset_class`, `asset_no`, `asset_name`, `amount`, `currency`, `emp_no`, `dept_code`, `purchase_date`.
   - Right nodes: `资产小类`, `资产编码`, `资产名称`, `原值`, `币种`, `工号`, `部门编码`, `取得日期`.
   - Draw source-like curved blue/green/orange connector paths with visible crossing relationships.
   - Use circular endpoints and green/orange status dots exactly like the source.
   - Do not render all connectors as straight horizontal lines.

2. Right `字段映射配置编辑区` must show real readable values, not dots, placeholder dashes, blanks, or clipped native-select text.
   - Use compact dropdown-look boxes or input-look boxes if native select clipping would hide the text.
   - Visible labels and values must be readable in this order:
     `配置名称 *` -> `MES 设备绑定`
     `外部系统 *` -> `MES`
     `接口端点 *` -> `/api/asset/bind`
     `源字段 *` -> `asset_class`
     `目标字段 *` -> `资产小类`
     `转换规则 *` -> `映射表` plus the `配置` button
     green rule note: `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他` and `规则有效`
     `默认值` -> `请输入默认值`
     `必填策略 *` -> `必填校验`
     `异常处理 *` -> `进入数据异常队列`
     `审计要求 *` -> `记录变更明细`
   - Bottom buttons must be visible and source-aligned: `保存草稿`, `提交校验`, `样例校验`.
   - No internal scrollbar in the right editor.

3. Bottom row must match the IMAGE2 source:
   - Keep four bottom cards from x/y positions like the source:
     `样例数据预览（前 5 行）`, `缺失字段异常（共 2 条）`, `冲突检测（共 1 条）`, `发布门禁`.
   - Bottom-left sample table must show five visible rows and full codes:
     `M2024050001` through `M2024050005`
     `ZC2024050001` through `ZC2024050005`
     row 5: `D`, `M2024050005`, `设备 E`, `1500.00`, `CNY`, `其他`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`.
   - The sample table may use 6.5px-7px text, but no ellipsis, no clipping, no text merging, no wrapping.
   - `缺失字段异常` must show rows `emp_no` and `dept_code`, with the bottom link `进入异常队列`.
   - `冲突检测` must show `asset_no`, `重复值`, conflict detail, high severity badge, and the bottom link `查看冲突详情`.
   - `发布门禁` must show the five checklist rows and exact full-width labels:
     `字段映射校验` `通过`
     `转换规则校验` `通过`
     `样例数据校验` `通过`
     `缺失字段处理` `警告（2）`
     `冲突检测` `失败（1）`
     plus the disabled `发布` button.

4. Preserve source shell and page density:
   - Top shell, sidebar active item, title, subtitle, action buttons, filters, and four mapping cards must remain source-like.
   - Left mapping table must keep the source columns and 10 visible rows.
   - Do not introduce page-level scroll or source-visible internal scroll.

Hard failures:
- Screenshot is not exactly `1586 x 992`.
- Page-level scroll appears.
- Mapping canvas connectors are straight horizontal lines.
- Right editor values show dots, placeholders, blanks, or clipped text.
- Sample codes are clipped or abbreviated.
- `警告（2）` or `失败（1）` is missing or uses ASCII parentheses.
