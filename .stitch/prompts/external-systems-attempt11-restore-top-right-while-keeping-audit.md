This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not change business data.

Page name: 外部系统接入配置台
Menu id: system-external-systems
Reference image: integration-subpage-01-external-systems-v2.png

Use the current candidate as base only for the successful bottom `同步策略` idea: keep all four rows visible including `审计归档`.
Repair the source-layout regressions introduced by the current candidate.

Hard source-layout repairs:
1. Restore the source top KPI geometry:
   - The four KPI cards `接入系统 5`, `已启用 4`, `待认证 1`, `今日同步 1260` must be one horizontal row above the center table.
   - They must not become a 2x2 block inside the left system list column.
   - The left column starts below the KPI band with the search input and system cards, matching IMAGE2.

2. Restore the right `系统属性` panel completeness:
   - Right panel must show fields down to `数据范围` and `失败处理`.
   - Keep buttons `保存系统`, `测试连接`, `查看审计`.
   - Below it keep `发布校验 5/6` with `系统编码`, `认证方式`, `接口端点`, `字段映射`, `失败处理`, `审计留痕`.
   - Do not clip after `负责人`.

3. Restore the left list bottom:
   - `新建外部系统` card must be fully visible, not cut by the viewport.
   - Keep all six source cards: `MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`, `供应商门户`, `新建外部系统`.

4. Preserve the successful bottom middle fix:
   - `同步策略` panel must show all four rows:
     `全量初始化`, `增量同步`, `失败重试`, `审计归档`.
   - `审计归档` description `同步记录与变更日志长期留存` must be visible.

5. Preserve the center table:
   - `接入系统清单` table must show all six rows including `异常队列 Webhook`.
   - Footer `共 6 条`, page `1`, `10 条/页` visible.

Exact text:
Use `待认证`; never use `待补认证`.
Use source-like `外部系统接入配置台`, `接入链路预览`, `同步策略`, `发布校验 5/6`.

Fit everything in the exact 1586 x 992 viewport with no page-level scroll.
