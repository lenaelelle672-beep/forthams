# Notes DXL 全量恢复分析

本文件为从 `/Users/feigao/Downloads/flow_complete_design.dxl` 重新生成的全量索引版分析。按流程阅读请优先使用 `flows/` 下的拆分文档。

## 主业务表单总览

| 表单 | alias/属性 | 字段 | 按钮 | action | 状态值摘要 |
| --- | --- | ---: | ---: | ---: | --- |
| 资产赔偿电子流 | `alias=zcpc; editonopen=true; designerversion=8.5.3; publicaccess=false` | 85 | 28 | 7 | 存为草稿 / 01.等待部门直接主管审核 / 终止申请 / 02.部门主管返回经办人 / 03.等待提供资产原值 / 04.资产管理处返回经办人 / 05.等待一级资产管理部门审核 / 06.一级资产管理部门返回经办人 / 07.等待资产管理处审批 / 08.资产管理处返回经办人 / 06A.等待信息安全审批 / 10.等待财务总监审批 / 09.资产管理处审批通过 / 责任人异议，提交一级资产管理员 / 等待责任人确认 / 一级资产管理员驳回异议 / 等待财务总监审批 / 提交第三审批人 / 06B.信息安全返回经办人 / 12.财务总监返回经办人 / 13.财务总监返回信息安全审批 / 14.财务总监返回资产管理处 / 11.财务总监审批完成 / 12.等待库房接收资产 / 12.库房审批完成 |
| 配件类型 | `publicaccess=false` | 3 | 0 | 0 | 未识别到 now_status 状态赋值 |
| zichanchu2 | `publicaccess=false` | 5 | 0 | 0 | 未识别到 now_status 状态赋值 |
| 库房管理员id | `nocompose=true; publicaccess=false` | 1 | 0 | 0 | 未识别到 now_status 状态赋值 |
| 资产存放地点表 | `nocompose=true; publicaccess=false` | 3 | 0 | 9 | 未识别到 now_status 状态赋值 |
| 清退原因 | `nocompose=true; publicaccess=false` | 1 | 0 | 9 | 未识别到 now_status 状态赋值 |
| bh3 | `nocompose=true; publicaccess=false` | 2 | 0 | 0 | 未识别到 now_status 状态赋值 |
| bh1 | `nocompose=true; publicaccess=false` | 2 | 0 | 0 | 未识别到 now_status 状态赋值 |
| 配件转移电子流 | `editonopen=true; designerversion=8.5.3; publicaccess=false` | 95 | 22 | 7 | 存为草稿 / 转出人确认 / 转入部门资产管理员审批 / 转入人确认 / 返回申请人 / 资产核算处审核 / 转出部门资产管理员审批 / 结束 |
| zichanchu | `publicaccess=false` | 2 | 0 | 0 | 未识别到 now_status 状态赋值 |
| 部门编码配置表 | `alias=bmpzb; designerversion=8.5.3; publicaccess=false` | 3 | 0 | 9 | 未识别到 now_status 状态赋值 |
| 数据库配置表 | `alias=sjkb; designerversion=8.5.3; publicaccess=false` | 2 | 0 | 6 | 未识别到 now_status 状态赋值 |
| zichanchu4 | `publicaccess=false` | 2 | 0 | 0 | 未识别到 now_status 状态赋值 |
| 资产赔偿电子流20041207old | `nocompose=true; editonopen=true; publicaccess=false` | 68 | 19 | 7 | 存为草稿 / 01.等待部门直接主管审核 / 02.部门主管返回经办人 / 03.等待提供资产原值 / 04.资产管理处返回经办人 / 05.等待一级资产管理部门审核 / 06.一级资产管理部门返回经办人 / 07.等待资产管理处审批 / 08.资产管理处返回经办人 / 10.等待财务总监审批 / 09.资产管理处审批通过 / 责任人异议，提交一级资产管理员 / 等待责任人确认 / 一级资产管理员驳回异议 / 等待财务总监审批 / 提交第三审批人 / 11.财务总监审批完成 |
| 资产转移电子流 | `alias=zczy; nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false` | 64 | 16 | 7 | 存为草稿 / 转入部门资产管理员审批 / 资产管理员不同意返回申请人 / 部门主管审批 / 部门主管返回申请人 / 资产转出人确认 / 资产转出人返回申请人 / 转出部门资产管理员审批 / 转出部门资产管理员返回申请人 / 转出部门主管审批 / 转出部门主管返回申请人 / 资产核算处审核 / 结束 / 资产核算处返回申请人 |
| bh2 | `nocompose=true; publicaccess=false` | 2 | 0 | 0 | 未识别到 now_status 状态赋值 |
| 资产调拨电子流 | `nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false` | 66 | 16 | 7 | 存为草稿 / 部门直接主管审批 / 返回申请人 / 部门一级资产管理员审批 / 部门资产管理员审批 / 等待部门权签人审批 / 等待资产管理处确认 / 等待回收库房确认 / 结束 |
| zichanchu3 | `designerversion=8.5.3; publicaccess=false` | 7 | 0 | 6 | 未识别到 now_status 状态赋值 |
| 配件清退电子流 | `nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false` | 62 | 12 | 7 | 存为草稿 / 清退部门一级资产管理员审批 / 返回申请人 / 清退部门主管审批 / 等待回收库房确认 / 结束 |
| 查询表单 | `designerversion=8.5.3; publicaccess=false` | 3 | 0 | 6 | 未识别到 now_status 状态赋值 |
| 一级资产管理员id | `nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | 0 | 19 | 未识别到 now_status 状态赋值 |
| bh | `alias=bh; nocompose=true; publicaccess=false` | 2 | 0 | 0 | 未识别到 now_status 状态赋值 |
| zichanchu5 | `designerversion=8.5.3; publicaccess=false` | 4 | 0 | 19 | 未识别到 now_status 状态赋值 |
| 资产清退电子流 | `nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false` | 86 | 20 | 7 | 存为草稿 / 清退部门资产管理员审批 / 清退部门一级资产管理员审批 / 终止申请 / 返回申请人 / 清退部门主管审批 / 等待回收库房确认 / 结束 / IT判断人员审核 |
| zichanchu1 | `publicaccess=false` | 2 | 0 | 0 | 未识别到 now_status 状态赋值 |
| zichanchu21 | `publicaccess=false` | 5 | 0 | 0 | 未识别到 now_status 状态赋值 |
| 新资产转移电子流 | `editonopen=true; designerversion=8.5.3; publicaccess=false` | 90 | 29 | 9 | 存为草稿 / 资产核算处审核 / 结束 / 转出部门资产管理员审批 / 转出人确认 / 转入部门资产管理员审批 / 转入人确认 / 终止申请 / 返回申请人 / 资产转出人确认 / 转出部门主管审批 |
| 一级资源管理部门ID | `alias=bfid; nocompose=true; designerversion=6.5; publicaccess=false` | 2 | 0 | 6 | 未识别到 now_status 状态赋值 |
| 资产报废电子流 | `alias=zcbf; editonopen=true; designerversion=8.5.3; publicaccess=false` | 744 | 43 | 7 | 存为草稿 / 直接主管审批 / 终止申请 / 管理办/运作支持部审核 / 返回申请人 / 一级资源管理部门审核 / 资产原值处理 / 进出口部审批 / 信息安全审批 / 资产管理处审核 / 提交财务权签人审批 / 提交库房确认 / 提交资产核算处确认 / 提交接收异地报废资产审批 / 结束 / 提交处置异地报废资产 / 提交确认收款 |
| bh21 | `nocompose=true; designerversion=6.5; publicaccess=false` | 2 | 0 | 6 | 未识别到 now_status 状态赋值 |
| 新资产转移电子流bak | `editonopen=true; designerversion=8.5.3; publicaccess=false` | 85 | 26 | 9 | 存为草稿 / 资产核算处审核 / 转出部门资产管理员审批 / 转出人确认 / 转入部门资产管理员审批 / 转入人确认 / 返回申请人 / 资产转出人确认 / 转出部门主管审批 / 结束 |
| 部门资产管理人配置表 | `alias=deptPmConfigForm; designerversion=8.5.3; publicaccess=false` | 3 | 1 | 0 | 未识别到 now_status 状态赋值 |
| dbHelpAbout | `designerversion=6.5; publicaccess=false` | 1 | 0 | 0 | 未识别到 now_status 状态赋值 |
| dbHelpUsing | `designerversion=6.5; publicaccess=false` | 1 | 0 | 0 | 未识别到 now_status 状态赋值 |
| 数据库配置表2 | `alias=dbconfig; designerversion=8.5.3; publicaccess=false` | 3 | 0 | 6 | 未识别到 now_status 状态赋值 |
| 管理办/运作支持部ID | `alias=yzid; nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | 0 | 6 | 未识别到 now_status 状态赋值 |
| 筛选表单 | `designerversion=8.5.3; publicaccess=false` | 2 | 0 | 6 | 未识别到 now_status 状态赋值 |
| IT判断人员id | `alias=IT; nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | 0 | 19 | 未识别到 now_status 状态赋值 |
| 闲置资产类型 | `nocompose=true; designerversion=8.5.3; publicaccess=false` | 1 | 0 | 9 | 未识别到 now_status 状态赋值 |
| 信息安全审批员id | `alias=xxaq; nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | 0 | 19 | 未识别到 now_status 状态赋值 |
| 拷贝资产报废电子流 | `alias=NewAsset; editonopen=true; designerversion=8.5.3; publicaccess=false` | 735 | 41 | 7 | 存为草稿 / 直接主管审批 / 管理办/运作支持部审核 / 返回申请人 / 一级资源管理部门审核 / 资产原值处理 / 进出口部审批 / 信息安全审批 / 资产管理处审核 / 提交财务权签人审批 / 提交库房确认 / 提交资产核算处确认 / 提交接收异地报废资产审批 / 结束 / 提交处置异地报废资产 / 提交确认收款 |
| 资产信息 | `alias=AssentInfo; designerversion=8.5.3; publicaccess=false` | 7 | 0 | 0 | 未识别到 now_status 状态赋值 |
| 套账选项 | `alias=TaoZhang; designerversion=8.5.3; publicaccess=false` | 2 | 0 | 0 | 未识别到 now_status 状态赋值 |

## 主流程文档入口

- [分类总览](00-overview.md)
- [资产调拨](flows/asset-allocation.md)
- [资产转移](flows/asset-transfer.md)
- [配件转移](flows/accessory-transfer.md)
- [资产清退](flows/asset-return.md)
- [配件清退](flows/accessory-return.md)
- [资产报废](flows/asset-scrap.md)
- [资产赔偿](flows/asset-compensation.md)

## 设计元素统计

- 表单：43
- 视图：118
- 代理：10
- 脚本库：1
- 字段节点：2263
- 按钮节点：273
- action 节点：241

## 证据边界

- 该恢复版保留字段/按钮/action/视图/代理的结构化摘要。
- 复杂 LotusScript、隐藏公式和外部查询未完全语义化，需要回到 DXL 源文件核对。
