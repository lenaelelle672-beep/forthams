# forthAMS / UNIVIEW 固定资产平台产品套设计稿

## Context

Design a high-fidelity desktop B2B product suite for **UNIVIEW 固定资产平台**. It is an intelligent manufacturing and fixed-asset operations system for factories that connects MES, equipment status, asset location, temperature telemetry, maintenance work orders, spare parts, alarms, inspections, energy data, and security posture.

The result should feel like a polished enterprise command center, not a marketing landing page. Use dense but elegant information architecture, crisp Chinese labels, and realistic operational data.

## Visual Direction

- Overall style: premium blue-white industrial SaaS dashboard, clean futuristic manufacturing UI, similar to a high-end smart factory operations cockpit.
- Brand: use **UNIVIEW** and **固定资产平台** only. Do not use SEELINK or forthAMS in visible UI.
- Palette: deep navy header/sidebar (#061b38, #08254a), luminous blue (#1677ff), cyan (#23d3e6), mint success (#28c7a6), amber warning (#f5a623), red alert (#ff4d4f), cool white surfaces (#f8fbff).
- Surfaces: white cards with fine #dbeafe borders, radius 8-12px, very subtle or no shadow. Avoid heavy drop shadows.
- Layout: top dark navigation bar plus left icon sidebar. The top nav has these primary modules: 智能制造总览, 数据监控中心, 资产运维中心, 安全态势工作台.
- Images: include cohesive blue-white 3D/isometric product illustrations for CNC machines, robot arms, conveyors, AGV, warehouse racks, asset icons, security shields, circular health rings with gear details, map/network panels, and module thumbnail cards.
- Charts: circular health gauges, segmented rings, radar/orbit rings, line charts, bar charts, rank tables, China map risk distribution, maintenance timeline.
- Typography: modern Chinese system font, compact enterprise sizing, no oversized marketing hero except login/product visual areas.
- Interaction feel: segmented module switching, active nav underline, icon sidebar hover states, card drill-down affordances, small “详情 > / 全部 >” links.

## Required Screens

Generate a coherent suite, ideally multiple screens in one Stitch batch:

### 1. Login4 登录页

- Full desktop viewport.
- Immersive smart-factory background on the left: blue-white factory floor, CNC machines, robotic arm, conveyors, AGV, floating holographic MES panels.
- Login card on the right but not too far right; leave balanced space between hero image and form.
- Header brand: UNIVIEW 固定资产平台.
- Form: 登录系统, username, password, remember, forgot password, primary login, MaxKey 单点登录, demo account cards.
- Do not show KPI cards such as 资产总数 / 在线运行 / 待保数 / 异常预警 on the login page.

### 2. 智能制造总览

- Main dashboard with dark top bar and left icon sidebar.
- First large visual band: 产线总览 with a wide production line image, machines connected by IoT/Wi-Fi markers, status legend 运行中/待机/故障.
- Below: four module cards:
  - 机加设备集群 with 3D CNC cluster illustration
  - 数据监控中心 with dashboard thumbnail, 98.6% circular gauge, line chart
  - 资产运维中心 with 86 health ring, equipment status list
  - 安全态势工作台 with dark China map/security panel thumbnail
- Cards must have correct cropping, enough inner padding, and product illustration details.

### 3. 数据监控中心

- KPI header: 采集点位, 平均延迟, 今日产量, 异常波动.
- Large center circular telemetry gauge around 98.6%.
- Production line thumbnail on the right with sensor overlays.
- Charts: temperature trend, asset telemetry trend, device event table.
- Include icon style matching the asset kit.

### 4. 资产运维中心

- KPI cards: 资产总数 6,842; 在线运行 5,102; 待维保 248; 异常预警 36.
- Left: asset category statistics with small 3D icons for 生产设备、公用设备、辅助设备、检测设备、IT设备.
- Center: large 资产健康指数 ring with clean circular segmented ring, gear details, center number 86 and status 良好.
- Right: 高风险资产 TOP10 table.
- Add an ops visual panel: MES 对接, 在线状态, 所在位置, 温度, 维保状态, 资产告警, 设备分布, 健康评分.
- Include maintenance work order cards and status pills.

### 5. 安全态势工作台

- Dark/navy analysis panel style inside the same product shell.
- KPI strip: 节点设备总数, 安全评分, 风险设备, 攻击路径.
- Left circular score gauge 97.
- Center China map / network attack surface visualization.
- Right TOP10 vulnerability/risk table.
- Bottom: alarm timeline, rule hit trend, risk category bars.

## UX Requirements

- Top module tabs should visually read as switchable routes.
- Sidebar icons should be simple and precise: 首页, 资产总览, 设备管理, 工单管理, 巡检管理, 备件管理, 能耗管理, 报表分析, 告警中心, 维保策略.
- Every page should look like an actual usable app screen with realistic operational data, not a generic template.
- Avoid visible instructional text about how to use the UI.
- Avoid purple gradients, beige/brown palettes, and decorative blob backgrounds.
- All text must fit inside cards and buttons.

## Output Goal

Produce high-fidelity desktop screens that can be replicated in the React project. Maintain one consistent visual system and asset language across all screens.
