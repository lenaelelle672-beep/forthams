# 配置表单与通用流程机制

来源：`/Users/feigao/Downloads/flow_complete_design.dxl`。

## 配置表单

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
| 资产赔偿电子流20041207old | `nocompose=true; editonopen=true; publicaccess=false` | 68 | now_status / shenqingid / data / number / zcbh / zcmc / ggxh / fswp / bm / bmbm / syrid / sysj / syr / dh / dd / syrid_1 / syr_1 / yysm / dsrq / jbr / lxdh / yysm_1 / bmzg_1 / bmzg / sign1 / signtime1 / yijian_1 / guanlichuid / sign2_1 / signtime2_1 |
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
| 新资产转移电子流bak | `editonopen=true; designerversion=8.5.3; publicaccess=false` | 85 | DispTitle / now_status / guanlichuid / shenqingid / bianhao / rqi / bianhao1 / mingcheng1 / xinghao1 / wupin / zcrID / zrlID / zcbmbm / zcbm / zcren / zrbmbm / zrbm / zrren / yuanyin / hetonghao / glgs / c_bt / c_bt_1 / zccpbianhao / mangerid / mangerid1 / rmangerid / cmangerid / sign1 / signtime1 |
| 部门资产管理人配置表 | `alias=deptPmConfigForm; designerversion=8.5.3; publicaccess=false` | 3 | deptCode / deptName / deptPmID |
| dbHelpAbout | `designerversion=6.5; publicaccess=false` | 1 | body |
| dbHelpUsing | `designerversion=6.5; publicaccess=false` | 1 | body |
| 数据库配置表2 | `alias=dbconfig; designerversion=8.5.3; publicaccess=false` | 3 | dnname / server_name / data_name |
| 管理办/运作支持部ID | `alias=yzid; nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | name / dept |
| 筛选表单 | `designerversion=8.5.3; publicaccess=false` | 2 | date1 / date2 |
| IT判断人员id | `alias=IT; nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | name / dept |
| 闲置资产类型 | `nocompose=true; designerversion=8.5.3; publicaccess=false` | 1 | idle_assets |
| 信息安全审批员id | `alias=xxaq; nocompose=true; designerversion=8.5.3; publicaccess=false` | 2 | name / dept |
| 拷贝资产报废电子流 | `alias=NewAsset; editonopen=true; designerversion=8.5.3; publicaccess=false` | 735 | now_status / current_processor / DocNo / shenqingid / workcode / data / number / zcbh / zcmc / gueige / fswp / syrid / zccpbianhao / bmbm / szbm / time / name / telephone / didian / wmht / Jkdata / c_bt / aa_4 / ydbf / ccjz / sfyf / yysm / yysm_1 / wxyy / fj |
| 资产信息 | `alias=AssentInfo; designerversion=8.5.3; publicaccess=false` | 7 | fldauthor / AssetNumber / AssetName / AssetType / CurrentCost / AccumulateValue / NetBookValue |
| 套账选项 | `alias=TaoZhang; designerversion=8.5.3; publicaccess=false` | 2 | taozhangZ / taozhangE |

## 字段读写与隐藏条件证据

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

## 入口、在办、归档、打印与催办

### 可新建入口证据

视图 action 中可见 `@Command([Compose])`。其中部分目标表单带有 `nocompose=true`，运行期是否允许仍需 Notes ACL、客户端行为、表单属性共同验证。

| 视图 | 选择公式 | Compose 目标 |
| --- | --- | --- |
| 资产调拨\归档\按部门名称 | `SELECT form="资产调拨电子流"&mark="1"` | 资产调拨电子流 |
| 配件转移\按转出资产编号 | `SELECT form="配件转移电子流"&mark=""` | 配件转移电子流 |
| 资产转移\按状态 | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""` | 新资产转移电子流 |
| 资产清退\归档\按申请人ID | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 配件转移\按当前处理人 | `SELECT form="配件转移电子流"&mark=""&NOW_STATUS!="返回申请人"` | 配件转移电子流 |
| 资产调拨\按申请人ID | `SELECT form="资产调拨电子流"&mark=""` | 资产调拨电子流 |
| 资产清退\归档\按完成日期 | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 资产清退\按清退地点 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 资产调拨\归档\按部门编码 | `SELECT form="资产调拨电子流"&mark="1"` | 资产调拨电子流 |
| 设置\清退原因 | `SELECT form="清退原因"` | 清退原因 |
| 设置\库房管理员id | `SELECT form="库房管理员id"` | 库房管理员id |
| 资产转移\按转入部门编码 | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""` | 新资产转移电子流 |
| 设置\数据库配置表 | `SELECT form="sjkb"` | sjkb |
| 资产赔偿\按资产编号 | `SELECT form="zcpc"` | zcpc |
| 资产转移\按当前处理人 | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""&NOW_STATUS!="返回申请人"` | 新资产转移电子流 |
| 配件清退\按状态 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 资产转移\按转出部门编码 | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""` | 新资产转移电子流 |
| 资产报废\按申请人ID | `SELECT form="zcbf"` | zcbf |
| 资产报废\按填报日期 | `SELECT form="zcbf"` | zcbf |
| 设置\资产存放地点表 | `SELECT form="资产存放地点表"` | 资产存放地点表 |
| 资产赔偿\按状态 | `SELECT form="zcpc"` | zcpc |
| 配件转移\按转出部门编码 | `SELECT form="配件转移电子流"&mark=""` | 配件转移电子流 |
| 资产赔偿\按填报日期 | `SELECT form="zcpc"` | zcpc |
| 配件转移\按申请人ID | `SELECT form="配件转移电子流"&mark=""` | 配件转移电子流 |
| 配件清退\按申请人ID | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 配件转移\按转入部门编码 | `SELECT form="配件转移电子流"&mark=""` | 配件转移电子流 |
| 资产报废\按部门编码 | `SELECT form="zcbf"` | zcbf |
| 配件转移\按转入资产编号 | `SELECT form="配件转移电子流"&mark=""` | 配件转移电子流 |
| 资产转移\按资产编号 | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""` | 新资产转移电子流 |
| 配件转移\按状态 | `SELECT form="配件转移电子流"&mark=""` | 配件转移电子流 |
| 设置\资产核算处id（资产清退） | `SELECT form="zichanchu2"` | zichanchu2 |
| (设置\资产存放地点表1) | `SELECT form="资产存放地点表"` | 资产存放地点表 |
| 资产清退\归档\按资产编号 | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 配件转移\归档\按转出资产编号 | `SELECT form="配件转移电子流"&mark="1"` | 配件转移电子流 |
| 资产调拨\按填报日期 | `SELECT form="资产调拨电子流"&mark=""` | 资产调拨电子流 |
| 资产报废\按当前处理人 | `SELECT form="zcbf"` | zcbf |
| 资产转移\按填报日期 | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""` | 新资产转移电子流 |
| 配件转移\归档\按转出部门编码 | `SELECT form="配件转移电子流"&mark="1"` | 配件转移电子流 |
| 资产清退\按申请人ID | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 配件清退\按资产编号 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 资产转移\按申请人ID | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""` | 新资产转移电子流 |
| 资产调拨\按状态 | `SELECT form="资产调拨电子流"&mark=""` | 资产调拨电子流 |
| 配件清退\归档\按完成日期 | `SELECT form="配件清退电子流"&mark="1"` | 配件清退电子流 |
| 配件清退\按填报日期 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 资产清退\按资产编号 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 资产调拨\按资产编号 | `SELECT form="资产调拨电子流"&mark=""` | 资产调拨电子流 |
| 资产清退\部门资产管理员 | `SELECT form="一级资产管理员id"` | 一级资产管理员id |
| 资产调拨\归档\按完成日期 | `SELECT form="资产调拨电子流"&mark="1"` | 资产调拨电子流 |
| 配件转移\归档\按申请人ID | `SELECT form="配件转移电子流"&mark="1"` | 配件转移电子流 |
| 配件转移\归档\按转入资产编号 | `SELECT form="配件转移电子流"&mark="1"` | 配件转移电子流 |
| 配件清退\按清退部门编码 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 资产清退\按状态 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 资产清退\按填报日期 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 资产清退\归档\按填报日期 | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 报废 | `SELECT @All` | zcbf |
| 设置\部门编码配置表 | `SELECT form="bmpzb"` | bmpzb |
| 配件清退\归档\按申请人ID | `SELECT form="配件清退电子流"&mark="1"` | 配件清退电子流 |
| 资产报废\按状态 | `SELECT form="zcbf"` | zcbf |
| 配件转移\按填报日期 | `SELECT form="配件转移电子流"&mark=""` | 配件转移电子流 |
| 资产清退\归档\按清退部门编码 | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 配件转移\归档\按转入部门编码 | `SELECT form="配件转移电子流"&mark="1"` | 配件转移电子流 |
| 资产清退\归档\按资产名称 | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 资产调拨\按部门编码 | `SELECT form="资产调拨电子流"&mark=""` | 资产调拨电子流 |
| 配件清退\归档\按资产编号 | `SELECT form="配件清退电子流"&mark="1"` | 配件清退电子流 |
| 资产清退\按清退部门编码 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 赔偿 | `SELECT @All` | zcpc |
| 设置\一级资产管理员id\无标题 | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""` | 新资产转移电子流 |
| 资产转移\按转出产品编码 | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""` | 新资产转移电子流 |
| 资产转移\按转入产品编码 | `SELECT (form="zczy"\|form="新资产转移电子流")&mark=""` | 新资产转移电子流 |
| 设置\资产核算处id（配件清退） | `SELECT form="zichanchu21"` | zichanchu21 |
| (邮催视图) | `SELECT (form="zczy"\|form="新资产转移电子流"\|form="资产清退电子流"\|form="zcpc"\|form="zcbf"\|form="资产调拨电子流")&mark=""&NOW_STATUS!="终止申请"` | 新资产转移电子流 |
| 资产报废\部门资产管理员 | `SELECT form="bfid"` | bfid |
| 资产转移\部门资产管理员 | `SELECT form = "deptPmConfigForm"` | deptPmConfigForm |
| (资产转移\部门资产管理员) | `SELECT form = "deptPmConfigForm"` | deptPmConfigForm |
| 设置\数据库配置表2 | `SELECT form="dbconfig"` | dbconfig |
| (设置\部门编码配置表) | `SELECT form="bmpzb"` | bmpzb |
| 资产报废\管理办\运作支持部 | `SELECT form="yzid"` | yzid |
| 拷贝资产报废\管理办\运作支持部 | `SELECT form="yzid"` | yzid |
| 拷贝资产报废\按部门编码 | `SELECT form="zcbf"` | zcbf |
| 配件清退\按当前处理人 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 设置\IT判断人员 | `SELECT form="IT"` | IT |
| 设置\闲置资产类型 | `SELECT form="闲置资产类型"` | 闲置资产类型 |
| 设置\信息安全审批员 | `SELECT form="xxaq"` | xxaq |
| 资产报废\按资产编号 | `SELECT form="zcbf"` | zcbf |
| 资产调拨\按当前处理人 | `SELECT form="资产调拨电子流"&mark=""` | 资产调拨电子流 |
| 资产赔偿\按当前处理人 | `SELECT form="zcpc"` | zcpc |
| 资产清退\按当前处理人 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 资产信息\资产编号 | `SELECT Form = "AssentInfo"` | AssentInfo |
| 拷贝资产转移\按资产编号 | `SELECT (form="zczy"\|form="新资产转移电子流")&now_status="结束"&(@Date(@TextToTime(@Text(finish)))>=@Date(@TextToTime(@Text("2023-04-01")))&@Date(@TextToTime(@Text(finish)))<=@Date(@TextToTime(@Text("2023-04-30"))))` | 新资产转移电子流 |
| 拷贝(邮催视图) | `SELECT (form="zczy"\|form="新资产转移电子流"\|form="资产清退电子流"\|form="zcpc"\|form="zcbf"\|form="资产调拨电子流")&mark=""&NOW_STATUS!="终止申请"` | 新资产转移电子流 |
| 资产转移\套账信息配置 | `SELECT form="TaoZhang"` | TaoZhang |

### 催办/通知线索

| 代理 | 摘要 |
| --- | --- |
| 处理配件超期文档 | Option Public Sub Initialize On Error Goto ErrP Dim session As New notessession Dim db As notesdatabase Dim view As notesview Dim newdoc As notesdocument Dim rtitem As notesrichtextitem Dim doc As notesdocument Dim userstr As String Dim sec As String Set db=s… |
| 处理资产超期文档 | Option Public Sub Initialize On Error Goto ErrP Dim session As New notessession Dim db As notesdatabase Dim view As notesview Dim newdoc As notesdocument Dim rtitem As notesrichtextitem Dim doc As notesdocument Dim userstr As String Dim sec As String Set db=s… |
| 邮催 | Option Public Sub Initialize Msgbox "资产转移电子流开始邮催" On Error Goto ErrP Dim doc As notesdocument Dim s As New notessession Dim db As notesdatabase Dim view As notesview Set db=s.currentdatabase Set view = db.getview("mailVw1") Set doc = view.getfirstdocument Whi… |
| 等待回收库房确认状态5天邮催 | Option Public Option Declare Sub Initialize '资产清退电子流在“等待回收库房确认”环节，增加邮催功能 '在“等待回收库房确认”环节超过5天后，系统自动发邮催，主送申请人，抄送回收库房管理员，频率每天一封。 On Error Resume Next Dim s As New NotesSession Dim db As NotesDatabase Dim doc As NotesDocument Dim docView As NotesView Dim AToday As… |
| 获取id | %REM Agent 获取id Created 2018-2-7 by wuhao W3808/uniview01 Description: Comments for Agent %END REM Option Public Option Declare Sub Initialize Dim wks As New NotesUIWorkspace Dim uidoc As NotesUIDocument Set uidoc = wks.CurrentDocument Dim doc As NotesDocumen… |
| 20 超时催办 | Option Public Option Declare Sub Initialize On Error Goto errorh Dim se As New NotesSession Dim db As NotesDatabase Dim doc As NotesDocument,pDoc As NotesDocument Dim view As NotesView,docView As NotesView Dim dc As NotesDocumentCollection Dim AToday As Varia… |
| ExporterAllFormatElements | %REM Agent ExporterAllFormatElements Created 2026-6-23 by gaojingyu W4788/uniview01 Description: Comments for Agent %END REM Option Public Option Declare Sub Initialize Dim session As New NotesSession Dim db As NotesDatabase Dim stream As NotesStream Dim expo… |
| ExporterAllFormatElementsV2 | %REM Agent ExporterAllFormatElements Created 2026-6-23 by gaojingyu W4788/uniview01 Description: Comments for Agent %END REM Option Public Option Declare Sub Initialize On Error GoTo ErrHandler Dim session As New NotesSession Dim db As NotesDatabase Dim strea… |

## 证据边界

- 在办/归档、催办、打印等机制不能仅靠流程图表达，需要迁移为系统状态、通知/SLA、打印模板和归档策略。
- 外部 `@DbLookup` / `@PickList` 所依赖的数据源需要逐个映射到新系统表或 API。
