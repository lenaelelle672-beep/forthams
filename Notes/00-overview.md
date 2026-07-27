# Notes DXL 流程分类总览

来源：`/Users/feigao/Downloads/flow_complete_design.dxl`。

## 数据库元信息

- replicaid: `48258E1F002C4EC4`
- path: `C:\Users\admin\Desktop\资产管理\zczybf.nsf`
- title: `资产业务电子流`
- categories: `财务/财经管理部/国内财务部`
- documents: `0`; diskspace: `12058624`; percentused: `96.8134341032609`

## 分类索引

| 流程 | 文档 | 摘要 |
| --- | --- | --- |
| 资产调拨 | [flows/asset-allocation.md](flows/asset-allocation.md) | 跨部门/资产调拨申请、部门审批、资产管理处确认、回收库房确认。 |
| 资产转移 | [flows/asset-transfer.md](flows/asset-transfer.md) | 资产转出、转入确认、双方部门资产管理员审批和资产核算处审核。 |
| 配件转移 | [flows/accessory-transfer.md](flows/accessory-transfer.md) | 配件转出/转入确认、资产管理员审批、资产核算处审核。 |
| 资产清退 | [flows/asset-return.md](flows/asset-return.md) | 闲置/待清退资产申请、部门审批、IT 判断、回收库房确认。 |
| 配件清退 | [flows/accessory-return.md](flows/accessory-return.md) | 配件清退申请、部门/主管审批、回收库房确认。 |
| 资产报废 | [flows/asset-scrap.md](flows/asset-scrap.md) | 资产报废多级审批，含资产原值、进出口、信息安全、财务、库房、异地处置等分支。 |
| 资产赔偿 | [flows/asset-compensation.md](flows/asset-compensation.md) | 资产损失赔偿，含主管、资产管理、信息安全、财务、责任人异议等分支。 |

## 可直接证据

### 数据库元信息与设计元素数量

主要设计元素统计：表单 43 个、视图 118 个、代理 10 个、脚本库 1 个；字段节点 2263 个、按钮节点 273 个、action 节点 241 个。

### 主业务表单定位与数量

| 表单 | alias/属性 | DXL 行号 | 字段 | 按钮 | action | 状态值摘要 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 资产调拨电子流 | `nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false` | 86317 | 66 | 16 | 7 | 存为草稿 / 部门直接主管审批 / 返回申请人 / 部门一级资产管理员审批 / 部门资产管理员审批 / 等待部门权签人审批 / 等待资产管理处确认 / 等待回收库房确认 / 结束 |
| 资产转移电子流 | `alias=zczy; nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false` | 84611 | 64 | 16 | 7 | 存为草稿 / 转入部门资产管理员审批 / 资产管理员不同意返回申请人 / 部门主管审批 / 部门主管返回申请人 / 资产转出人确认 / 资产转出人返回申请人 / 转出部门资产管理员审批 / 转出部门资产管理员返回申请人 / 转出部门主管审批 / 转出部门主管返回申请人 / 资产核算处审核 / 结束 / 资产核算处返回申请人 |
| 新资产转移电子流 | `editonopen=true; designerversion=8.5.3; publicaccess=false` | 98692 | 90 | 29 | 9 | 存为草稿 / 资产核算处审核 / 结束 / 转出部门资产管理员审批 / 转出人确认 / 转入部门资产管理员审批 / 转入人确认 / 终止申请 / 返回申请人 / 资产转出人确认 / 转出部门主管审批 |
| 配件转移电子流 | `editonopen=true; designerversion=8.5.3; publicaccess=false` | 79143 | 95 | 22 | 7 | 存为草稿 / 转出人确认 / 转入部门资产管理员审批 / 转入人确认 / 返回申请人 / 资产核算处审核 / 转出部门资产管理员审批 / 结束 |
| 资产清退电子流 | `nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false` | 89753 | 86 | 20 | 7 | 存为草稿 / 清退部门资产管理员审批 / 清退部门一级资产管理员审批 / 终止申请 / 返回申请人 / 清退部门主管审批 / 等待回收库房确认 / 结束 / IT判断人员审核 |
| 配件清退电子流 | `nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false` | 88043 | 62 | 12 | 7 | 存为草稿 / 清退部门一级资产管理员审批 / 返回申请人 / 清退部门主管审批 / 等待回收库房确认 / 结束 |
| 资产报废电子流 | `alias=zcbf; editonopen=true; designerversion=8.5.3; publicaccess=false` | 103653 | 744 | 43 | 7 | 存为草稿 / 直接主管审批 / 终止申请 / 管理办/运作支持部审核 / 返回申请人 / 一级资源管理部门审核 / 资产原值处理 / 进出口部审批 / 信息安全审批 / 资产管理处审核 / 提交财务权签人审批 / 提交库房确认 / 提交资产核算处确认 / 提交接收异地报废资产审批 / 结束 / 提交处置异地报废资产 / 提交确认收款 |
| 资产赔偿电子流 | `alias=zcpc; editonopen=true; designerversion=8.5.3; publicaccess=false` | 75951 | 85 | 28 | 7 | 存为草稿 / 01.等待部门直接主管审核 / 终止申请 / 02.部门主管返回经办人 / 03.等待提供资产原值 / 04.资产管理处返回经办人 / 05.等待一级资产管理部门审核 / 06.一级资产管理部门返回经办人 / 07.等待资产管理处审批 / 08.资产管理处返回经办人 / 06A.等待信息安全审批 / 10.等待财务总监审批 / 09.资产管理处审批通过 / 责任人异议，提交一级资产管理员 / 等待责任人确认 / 一级资产管理员驳回异议 / 等待财务总监审批 / 提交第三审批人 / 06B.信息安全返回经办人 / 12.财务总监返回经办人 / 13.财务总监返回信息安全审批 / 14.财务总监返回资产管理处 / 11.财务总监审批完成 / 12.等待库房接收资产 / 12.库房审批完成 |

### 配置表单

| 表单 | alias/属性 | 字段 | 字段名 |
| --- | --- | ---: | --- |
| 配件类型 | `publicaccess=false` | 3 | guanli / jili / jili_1 |
| zichanchu2 | `publicaccess=false` | 5 | guanli / jili / manger / manger_1 / jili_1 |
| 库房管理员id | `nocompose=true; publicaccess=false` | 1 | name |
| 资产存放地点表 | `nocompose=true; publicaccess=false` | 3 | no / code / name |
| 清退原因 | `nocompose=true; publicaccess=false` | 1 | name |
| bh3 | `nocompose=true; publicaccess=false` | 2 | number / author |
| bh1 | `nocompose=true; publicaccess=false` | 2 | number / author |
| zichanchu | `publicaccess=false` | 2 | guanli / jili |
| 部门编码配置表 | `alias=bmpzb; designerversion=8.5.3; publicaccess=false` | 3 | key / server_name1 / data_name1 |
| 数据库配置表 | `alias=sjkb; designerversion=8.5.3; publicaccess=false` | 2 | server_name / data_name |
| zichanchu4 | `publicaccess=false` | 2 | guanli / manger |
| bh2 | `nocompose=true; publicaccess=false` | 2 | number / author |
| zichanchu3 | `designerversion=8.5.3; publicaccess=false` | 7 | guanli / jili_1 / jili / jckli / zcyz / zjglb / zcglb |
| 查询表单 | `designerversion=8.5.3; publicaccess=false` | 3 | date1 / date2 / taozhang |
| 一级资产管理员id | `nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | name / dept |
| bh | `alias=bh; nocompose=true; publicaccess=false` | 2 | number / author |
| zichanchu5 | `designerversion=8.5.3; publicaccess=false` | 4 | guanli / manger / safeID / coptFa |
| zichanchu1 | `publicaccess=false` | 2 | guanli / jili |
| zichanchu21 | `publicaccess=false` | 5 | guanli / jili / manger / manger_1 / jili_1 |
| 一级资源管理部门ID | `alias=bfid; nocompose=true; designerversion=6.5; publicaccess=false` | 2 | name / dept |
| bh21 | `nocompose=true; designerversion=6.5; publicaccess=false` | 2 | number / author |
| 部门资产管理人配置表 | `alias=deptPmConfigForm; designerversion=8.5.3; publicaccess=false` | 3 | deptCode / deptName / deptPmID |
| dbHelpAbout | `designerversion=6.5; publicaccess=false` | 1 | body |
| dbHelpUsing | `designerversion=6.5; publicaccess=false` | 1 | body |
| 数据库配置表2 | `alias=dbconfig; designerversion=8.5.3; publicaccess=false` | 3 | dnname / server_name / data_name |
| 管理办/运作支持部ID | `alias=yzid; nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | name / dept |
| 筛选表单 | `designerversion=8.5.3; publicaccess=false` | 2 | date1 / date2 |
| IT判断人员id | `alias=IT; nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | name / dept |
| 闲置资产类型 | `nocompose=true; designerversion=8.5.3; publicaccess=false` | 1 | idle_assets |
| 信息安全审批员id | `alias=xxaq; nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | name / dept |
| 资产信息 | `alias=AssentInfo; designerversion=8.5.3; publicaccess=false` | 7 | fldauthor / AssetNumber / AssetName / AssetType / CurrentCost / AccumulateValue / NetBookValue |
| 套账选项 | `alias=TaoZhang; designerversion=8.5.3; publicaccess=false` | 2 | taozhangZ / taozhangE |

### 字段读写与隐藏条件证据

字段节点自身提供 `type`、`kind`、`authors/readers/names/keyword`、`computed/computedwhencomposed/computedfordisplay/editable` 等读写属性；字段级事件以 `defaultvalue`、`entering`、`exiting`、`initialize`、`terminate`、`Postopen` 为主。界面隐藏条件主要以 `hidewhen` 公式出现，DXL 不总能把这些条件唯一映射到单个字段。

| 表单 | hidewhen 数 | 代表性隐藏条件摘要 |
| --- | ---: | --- |
| 资产调拨电子流 | 20 | `@Contains(m1;"1"); 1; jsrid_5=""; zcmangerid=""` |
| 资产转移电子流 | 11 | `jsrid_5=""; zcmangerid=""; !@Contains(t1;"1"); 1` |
| 新资产转移电子流 | 46 | `@If(@Subset(@DbName;1)=""\|@Contains(@Subset(@DbName;1);"ts");@False;@True); jsrid_5=""; zcmangerid=""; 1` |
| 配件转移电子流 | 41 | `jsrid_5=""; zcmangerid=""; 1; !@Contains(t3;"1")` |
| 资产清退电子流 | 32 | `1; jsrid_5=""; zcmangerid=""; !yuanyin="资产状态良好，已发布闲置公告满三个月"` |
| 配件清退电子流 | 9 | `@Contains(m1;"1"); @Contains(m6;"1")\|@Contains(m4;"1"); 1; zcmangerid=""` |
| 资产报废电子流 | 759 | `1; jsrid_5=""; aa_4 = "是"; @Contains(aa_4;"是")` |
| 资产赔偿电子流 | 12 | `jsrid_5=""; 1; safe="2"; zcsfxyyjzbfk = "否"` |

### 在办、归档、打印与催办视图证据

- 在办视图多以 `mark=""` 筛选，归档视图多以 `mark="1"` 筛选。
- `current_processor` 常用于“按当前处理人/状态”列展示。
- 催办视图和代理中可见 2 天、5 天、20 天等超时提醒线索。

## 代理与后台逻辑

| 代理 | 属性 | 摘要 |
| --- | --- | --- |
| 未定义 | `publicaccess=false; hide=v3` |  |
| 处理配件超期文档 | `activatable=false; publicaccess=false; designerversion=6.5; hide=v3` | Option Public Sub Initialize On Error Goto ErrP Dim session As New notessession Dim db As notesdatabase Dim view As notesview Dim newdoc As notesdocument Dim rtitem As notesrichtextitem Dim doc As notesdocument Dim userstr As String Dim sec As String Set db=session.currentdataba… |
| 处理资产超期文档 | `activatable=false; publicaccess=false; designerversion=6.5; hide=v3` | Option Public Sub Initialize On Error Goto ErrP Dim session As New notessession Dim db As notesdatabase Dim view As notesview Dim newdoc As notesdocument Dim rtitem As notesrichtextitem Dim doc As notesdocument Dim userstr As String Dim sec As String Set db=session.currentdataba… |
| 邮催 | `activatable=false; publicaccess=false; designerversion=8.5.3; hide=v3` | Option Public Sub Initialize Msgbox "资产转移电子流开始邮催" On Error Goto ErrP Dim doc As notesdocument Dim s As New notessession Dim db As notesdatabase Dim view As notesview Set db=s.currentdatabase Set view = db.getview("mailVw1") Set doc = view.getfirstdocument While Not doc Is Nothin… |
| 等待回收库房确认状态5天邮催 | `alias=agWaitKeep; activatable=false; publicaccess=false; designerversion=8.5.3; hide=v3` | Option Public Option Declare Sub Initialize '资产清退电子流在“等待回收库房确认”环节，增加邮催功能 '在“等待回收库房确认”环节超过5天后，系统自动发邮催，主送申请人，抄送回收库房管理员，频率每天一封。 On Error Resume Next Dim s As New NotesSession Dim db As NotesDatabase Dim doc As NotesDocument Dim docView As NotesView Dim AToday As Variant Dim i As In… |
| 获取id | `alias=getIdNumber; publicaccess=false; designerversion=8.5.3; hide=v3` | %REM Agent 获取id Created 2018-2-7 by wuhao W3808/uniview01 Description: Comments for Agent %END REM Option Public Option Declare Sub Initialize Dim wks As New NotesUIWorkspace Dim uidoc As NotesUIDocument Set uidoc = wks.CurrentDocument Dim doc As NotesDocument Set doc = uidoc.Do… |
| 刷新文档 | `publicaccess=false; designerversion=8.5.3; hide=v3` | @Command([ToolsRefreshSelectedDocs]); SELECT @All |
| 20 超时催办 | `alias=agOverTime; activatable=false; publicaccess=false; designerversion=8.5.3; hide=v3` | Option Public Option Declare Sub Initialize On Error Goto errorh Dim se As New NotesSession Dim db As NotesDatabase Dim doc As NotesDocument,pDoc As NotesDocument Dim view As NotesView,docView As NotesView Dim dc As NotesDocumentCollection Dim AToday As Variant Set db = se.Curre… |
| ExporterAllFormatElements | `alias=ExporterAllFormatElements; publicaccess=false; designerversion=8.5.3; hide=v3` | %REM Agent ExporterAllFormatElements Created 2026-6-23 by gaojingyu W4788/uniview01 Description: Comments for Agent %END REM Option Public Option Declare Sub Initialize Dim session As New NotesSession Dim db As NotesDatabase Dim stream As NotesStream Dim exporter As NotesDXLExpo… |
| ExporterAllFormatElementsV2 | `alias=ExporterAllFormatElementsV2; publicaccess=false; designerversion=8.5.3; hide=v3` | %REM Agent ExporterAllFormatElements Created 2026-6-23 by gaojingyu W4788/uniview01 Description: Comments for Agent %END REM Option Public Option Declare Sub Initialize On Error GoTo ErrHandler Dim session As New NotesSession Dim db As NotesDatabase Dim stream As NotesStream Dim… |

## 推断

- `now_status` 是各主流程的状态机核心字段。
- “提交/通过审批/确认/结束/返回申请人/终止申请”按钮是状态流转主动力。
- 按原分类不合并时，旧资产转移、新资产转移、配件转移、配件清退等需要独立业务类型或独立运行接入。

## 未能从 DXL 完全确定

- Notes ACL、角色、读写权限、客户端版本和运行期环境无法仅从 DXL 完整还原。
- DXL 中按钮脚本可见状态赋值和校验提示，但依赖外部 NSF、视图或运行期文档数据的分支无法验证命中率。
- 隐藏/读写条件大量以 `hidewhen`、段落/表格/按钮级公式存在，不总是与单个字段一一绑定。
- 打印逻辑在 DXL 中以视图筛选、按钮/动作线索呈现；没有运行 Notes 客户端验证页面效果。

## 证据分区小结

- 可直接证据：数据库元属性、设计元素计数、表单/字段/action/button 节点、视图选择公式、代理节点。
- 推断：状态机主线、在办/归档含义、当前处理人用途、按钮触发的业务流转。
