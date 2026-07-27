# 资产清退流程

来源：`/Users/feigao/Downloads/flow_complete_design.dxl`。

## 关注范围

闲置/待清退资产申请、部门审批、IT 判断、回收库房确认。

## 入口与表单

| 视图 | 选择公式 | 新建入口 |
| --- | --- | --- |
| 资产清退\归档\按申请人ID | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 资产清退\归档\按完成日期 | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 资产清退\按清退地点 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 设置\资产核算处id（资产清退） | `SELECT form="zichanchu2"` | zichanchu2 |
| 资产清退\归档\按资产编号 | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 资产清退\按申请人ID | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 资产清退\按资产编号 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 资产清退\部门资产管理员 | `SELECT form="一级资产管理员id"` | 一级资产管理员id |
| 资产清退\按状态 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 资产清退\按填报日期 | `SELECT form="资产清退电子流"&mark=""` | 资产清退电子流 |
| 资产清退\归档\按填报日期 | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |
| 资产清退\归档\按清退部门编码 | `SELECT form="资产清退电子流"&mark="1"` | 资产清退电子流 |

## 表单字段与按钮逻辑

### 资产清退电子流

- 默认 businessType：`ASSET_CLEARANCE`
- 表单属性：`nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false`
- 字段/按钮/action 数：86 / 20 / 7
- 状态字段证据：`now_status` 相关状态摘要：存为草稿 / 清退部门资产管理员审批 / 清退部门一级资产管理员审批 / 终止申请 / 返回申请人 / 清退部门主管审批 / 等待回收库房确认 / 结束 / IT判断人员审核

#### 关键字段

| # | 字段名 | 类型 | kind | 属性摘要 | 默认/转换/校验/关键词摘要 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `needShowFax` | `text` | `editable` | type=text; kind=editable; name=needShowFax | defaultvalue: "0" |
| 2 | `needShowFax_1` | `text` | `editable` | type=text; kind=editable; name=needShowFax_1 | defaultvalue: "0" |
| 3 | `needShowFax_2` | `text` | `editable` | type=text; kind=editable; name=needShowFax_2 | defaultvalue: "0" |
| 4 | `needShowFax_3` | `text` | `editable` | type=text; kind=editable; name=needShowFax_3 | defaultvalue: "0" |
| 5 | `needShowFax_4` | `keyword` | `editable` | type=keyword; kind=editable; name=needShowFax_4 | defaultvalue: "0" |
| 6 | `now_status` | `text` | `computed` | type=text; kind=computed; name=now_status | defaultvalue: @If(now_status="";"填写申请";now_status) |
| 7 | `current_processor` | `text` | `computedfordisplay` | type=text; kind=computedfordisplay; name=current_processor | defaultvalue: @Name([CN];Author) |
| 8 | `shenqingid` | `names` | `computedwhencomposed` | type=names; kind=computedwhencomposed; name=shenqingid | defaultvalue: @UserName |
| 9 | `bianhao` | `text` | `computed` | type=text; kind=computed; name=bianhao | defaultvalue: bianhao |
| 10 | `rqi` | `datetime` | `computedwhencomposed` | type=datetime; kind=computedwhencomposed; name=rqi | defaultvalue: @Created |
| 11 | `bianhao1` | `text` | `computed` | type=text; kind=computed; name=bianhao1 | defaultvalue: bianhao1; entering: Sub Entering(Source As Field) Dim uidoc As notesuidocument Dim wks As New notesuiworkspace Dim doc As notesdocument Dim view As notesview Set uidoc=wks.currentdocument Set doc=uid… |
| 12 | `mingcheng1` | `text` | `computed` | type=text; kind=computed; name=mingcheng1 | defaultvalue: mingcheng1 |
| 13 | `xinghao1` | `text` | `editable` | type=text; kind=editable; name=xinghao1 | defaultvalue: xinghao1 |
| 14 | `wupin` | `text` | `computed` | type=text; kind=computed; name=wupin | defaultvalue: wupin |
| 15 | `zcrID` | `text` | `computed` | type=text; kind=computed; name=zcrID | defaultvalue: zcrID |
| 16 | `zrlID` | `datetime` | `computed` | type=datetime; kind=computed; name=zrlID | defaultvalue: zrlid |
| 17 | `zcbmbm` | `text` | `computed` | type=text; kind=computed; name=zcbmbm | defaultvalue: zcbmbm |
| 18 | `zcbm` | `text` | `computed` | type=text; kind=computed; name=zcbm | defaultvalue: zcbm |
| 19 | `zcren` | `text` | `computed` | type=text; kind=computed; name=zcren | defaultvalue: zcren |
| 20 | `rmangerid` | `names` | `editable` | type=names; kind=editable; name=rmangerid |  |
| 21 | `zrren` | `names` | `computed` | type=names; kind=computed; name=zrren | defaultvalue: zrren |
| 22 | `idle_assets` | `keyword` | `editable` | type=keyword; kind=editable; name=idle_assets | exiting: Sub Exiting(Source As Field) Dim wks As New NotesUIWorkspace Dim ss As New NotesSession Dim s As New notessession Dim db As NotesDatabase Dim uidoc As NotesUIDocument Dim doc,doc1… |
| 23 | `yuanyin` | `keyword` | `editable` | type=keyword; kind=editable; name=yuanyin | defaultvalue: yuanyin |
| 24 | `reson` | `text` | `editable` | type=text; kind=editable; name=reson |  |
| 25 | `region` | `text` | `editable` | type=text; kind=editable; name=region | defaultvalue: region |
| 26 | `louhao` | `text` | `editable` | type=text; kind=editable; name=louhao | defaultvalue: louhao |
| 27 | `louceng` | `text` | `editable` | type=text; kind=editable; name=louceng | defaultvalue: louhao |
| 28 | `fangjian` | `text` | `editable` | type=text; kind=editable; name=fangjian | defaultvalue: louhao |
| 29 | `mangerid` | `names` | `editable` | type=names; kind=editable; name=mangerid |  |
| 30 | `prepareLink` | `richtext` | `editable` | type=richtext; kind=editable; name=prepareLink |  |
| ... | ... | ... | ... | ... | 共 86 个字段，完整字段见全量分析或 DXL |

#### 按钮/action 摘要

| 类型 | 文本/标题 | 摘要 |
| --- | --- | --- |
| action | Categori_ze |  |
| action | _Edit Document |  |
| action | Send Docu_ment |  |
| action | _Forward |  |
| action | _Move To Folder... |  |
| action | _Remove From Folder |  |
| action | 退出 | click: @Command([FileCloseWindow]) |
| button | (无显示文本/图标按钮) | 选择视图 资产编号; 查库 NumberView / bmbm |
| button | (无显示文本/图标按钮) | click: Sub Click(Source As Button) Call qtImportNumber() End Sub |
| button | (无显示文本/图标按钮) | 选择视图 一级资源管理员ID |
| button | (无显示文本/图标按钮) | 选择视图 清退原因 |
| button | (无显示文本/图标按钮) | 状态->清退部门资产管理员审批 / 清退部门一级资产管理员审批; 校验/提示 请输入资产编号 / 请输入使用人ID / 请输入所缺配件 / 请指定直接主管ID / 请指定部门资产管理员ID; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->存为草稿 |
| button | (无显示文本/图标按钮) | 状态->终止申请 |
| button | (无显示文本/图标按钮) | 状态->返回申请人; 校验/提示 请填写审批意见 / 请选择是否低格 / 请输入低格码; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->清退部门一级资产管理员审批; 校验/提示 请输入审批意见 / 请选择是否低格 / 请输入低格码; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->返回申请人; 校验/提示 请填写审批意见; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->清退部门主管审批; 校验/提示 请输入审批意见 / 请输入回收库房人员ID; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->返回申请人; 校验/提示 请填写审批意见; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->等待回收库房确认; 校验/提示 请输入审批意见; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 选择视图 配件类型 |
| button | (无显示文本/图标按钮) | 选择视图 IT判断人员 |
| button | (无显示文本/图标按钮) | 状态->结束; 校验/提示 请提供所缺配件记录; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->返回申请人; 校验/提示 请填写不接受原因; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->IT判断人员审核; 校验/提示 请输入IT判断人员ID; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->返回申请人; 校验/提示 请选择电脑是否低格 / 请从硬件、部件检测电脑性能 / 请输入性能不佳具体信息; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->结束; 校验/提示 请选择电脑是否低格; 含邮件/通知逻辑 |

推断主线：`存为草稿 -> 清退部门资产管理员审批 -> 清退部门一级资产管理员审批 -> 终止申请 -> 返回申请人 -> 清退部门主管审批 -> 等待回收库房确认 -> 结束 -> IT判断人员审核`。

## 流程图走向（推断）

```mermaid
flowchart TD
    F1_0["资产清退电子流: 开始"]
    F1_1["存为草稿"]
    F1_0 --> F1_1
    F1_2["清退部门资产管理员审批"]
    F1_1 --> F1_2
    F1_3["清退部门一级资产管理员审批"]
    F1_2 --> F1_3
    F1_4["终止申请"]
    F1_3 --> F1_4
    F1_5["返回申请人"]
    F1_4 --> F1_5
    F1_6["清退部门主管审批"]
    F1_5 --> F1_6
    F1_7["等待回收库房确认"]
    F1_6 --> F1_7
    F1_8["结束"]
    F1_7 --> F1_8
    F1_9["IT判断人员审核"]
    F1_8 --> F1_9
```

## 字段明细

### 字段明细：资产清退电子流

| # | 字段名 | 类型 | kind | 属性摘要 | 默认/转换/校验/关键词摘要 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `needShowFax` | `text` | `editable` | type=text; kind=editable; name=needShowFax | defaultvalue: "0" |
| 2 | `needShowFax_1` | `text` | `editable` | type=text; kind=editable; name=needShowFax_1 | defaultvalue: "0" |
| 3 | `needShowFax_2` | `text` | `editable` | type=text; kind=editable; name=needShowFax_2 | defaultvalue: "0" |
| 4 | `needShowFax_3` | `text` | `editable` | type=text; kind=editable; name=needShowFax_3 | defaultvalue: "0" |
| 5 | `needShowFax_4` | `keyword` | `editable` | type=keyword; kind=editable; name=needShowFax_4 | defaultvalue: "0" |
| 6 | `now_status` | `text` | `computed` | type=text; kind=computed; name=now_status | defaultvalue: @If(now_status="";"填写申请";now_status) |
| 7 | `current_processor` | `text` | `computedfordisplay` | type=text; kind=computedfordisplay; name=current_processor | defaultvalue: @Name([CN];Author) |
| 8 | `shenqingid` | `names` | `computedwhencomposed` | type=names; kind=computedwhencomposed; name=shenqingid | defaultvalue: @UserName |
| 9 | `bianhao` | `text` | `computed` | type=text; kind=computed; name=bianhao | defaultvalue: bianhao |
| 10 | `rqi` | `datetime` | `computedwhencomposed` | type=datetime; kind=computedwhencomposed; name=rqi | defaultvalue: @Created |
| 11 | `bianhao1` | `text` | `computed` | type=text; kind=computed; name=bianhao1 | defaultvalue: bianhao1; entering: Sub Entering(Source As Field) Dim uidoc As notesuidocument Dim wks As New notesuiworkspace Dim doc As notesdocument Dim view As notesview Set uidoc=wks.currentdocument Set doc=uid… |
| 12 | `mingcheng1` | `text` | `computed` | type=text; kind=computed; name=mingcheng1 | defaultvalue: mingcheng1 |
| 13 | `xinghao1` | `text` | `editable` | type=text; kind=editable; name=xinghao1 | defaultvalue: xinghao1 |
| 14 | `wupin` | `text` | `computed` | type=text; kind=computed; name=wupin | defaultvalue: wupin |
| 15 | `zcrID` | `text` | `computed` | type=text; kind=computed; name=zcrID | defaultvalue: zcrID |
| 16 | `zrlID` | `datetime` | `computed` | type=datetime; kind=computed; name=zrlID | defaultvalue: zrlid |
| 17 | `zcbmbm` | `text` | `computed` | type=text; kind=computed; name=zcbmbm | defaultvalue: zcbmbm |
| 18 | `zcbm` | `text` | `computed` | type=text; kind=computed; name=zcbm | defaultvalue: zcbm |
| 19 | `zcren` | `text` | `computed` | type=text; kind=computed; name=zcren | defaultvalue: zcren |
| 20 | `rmangerid` | `names` | `editable` | type=names; kind=editable; name=rmangerid |  |
| 21 | `zrren` | `names` | `computed` | type=names; kind=computed; name=zrren | defaultvalue: zrren |
| 22 | `idle_assets` | `keyword` | `editable` | type=keyword; kind=editable; name=idle_assets | exiting: Sub Exiting(Source As Field) Dim wks As New NotesUIWorkspace Dim ss As New NotesSession Dim s As New notessession Dim db As NotesDatabase Dim uidoc As NotesUIDocument Dim doc,doc1… |
| 23 | `yuanyin` | `keyword` | `editable` | type=keyword; kind=editable; name=yuanyin | defaultvalue: yuanyin |
| 24 | `reson` | `text` | `editable` | type=text; kind=editable; name=reson |  |
| 25 | `region` | `text` | `editable` | type=text; kind=editable; name=region | defaultvalue: region |
| 26 | `louhao` | `text` | `editable` | type=text; kind=editable; name=louhao | defaultvalue: louhao |
| 27 | `louceng` | `text` | `editable` | type=text; kind=editable; name=louceng | defaultvalue: louhao |
| 28 | `fangjian` | `text` | `editable` | type=text; kind=editable; name=fangjian | defaultvalue: louhao |
| 29 | `mangerid` | `names` | `editable` | type=names; kind=editable; name=mangerid |  |
| 30 | `prepareLink` | `richtext` | `editable` | type=richtext; kind=editable; name=prepareLink |  |
| 31 | `zccpbianhao` | `text` | `computed` | type=text; kind=computed; name=zccpbianhao | defaultvalue: @If(zccpbianhao="";"";zccpbianhao); entering: Sub Entering(Source As Field) Dim uidoc As notesuidocument Dim wks As New notesuiworkspace Dim doc As notesdocument Dim view As notesview Set uidoc=wks.currentdocument Set doc=uid… |
| 32 | `c_bt` | `text` | `computedwhencomposed` | type=text; kind=computedwhencomposed; name=c_bt; allowmultivalues=true | defaultvalue: c_bt |
| 33 | `yysm_1` | `richtext` | `editable` | type=richtext; kind=editable; name=yysm_1 |  |
| 34 | `yysm_1_1` | `richtext` | `editable` | type=richtext; kind=editable; name=yysm_1_1 |  |
| 35 | `DeclareLink` | `richtext` | `editable` | type=richtext; kind=editable; name=DeclareLink |  |
| 36 | `sign1` | `names` | `computed` | type=names; kind=computed; name=sign1 | defaultvalue: sign1 |
| 37 | `signtime1` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime1 | defaultvalue: signtime1 |
| 38 | `yijian` | `text` | `editable` | type=text; kind=editable; name=yijian |  |
| 39 | `isLformat_1` | `keyword` | `editable` | type=keyword; kind=editable; name=isLformat_1 | keywords: 是 / 否 / 不涉及 |
| 40 | `lformatCode` | `text` | `editable` | type=text; kind=editable; name=lformatCode |  |
| 41 | `sign2_1` | `names` | `computed` | type=names; kind=computed; name=sign2_1 | defaultvalue: sign2 |
| 42 | `signtime2_1` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime2_1 | defaultvalue: signtime2 |
| 43 | `shenpiyijian` | `text` | `editable` | type=text; kind=editable; name=shenpiyijian |  |
| 44 | `aa` | `keyword` | `editable` | type=keyword; kind=editable; name=aa | defaultvalue: "否"; keywords: 否 / 是 |
| 45 | `jiliangyiqi` | `text` | `computed` | type=text; kind=computed; name=jiliangyiqi | defaultvalue: jiliangyiqi |
| 46 | `mangerid1_1` | `keyword` | `editable` | type=keyword; kind=editable; name=mangerid1_1 | defaultvalue: mangerid1_1 |
| 47 | `sign5` | `names` | `computed` | type=names; kind=computed; name=sign5 | defaultvalue: sign5 |
| 48 | `signtime5` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime5 | defaultvalue: signtime5 |
| 49 | `yijian_1` | `text` | `editable` | type=text; kind=editable; name=yijian_1 |  |
| 50 | `sign3` | `text` | `computed` | type=text; kind=computed; name=sign3 | defaultvalue: sign3 |
| 51 | `signtime3` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime3 | defaultvalue: signtime3 |
| 52 | `yijian2` | `text` | `editable` | type=text; kind=editable; name=yijian2 |  |
| 53 | `aa_1` | `keyword` | `editable` | type=keyword; kind=editable; name=aa_1 | defaultvalue: "否"; keywords: 否 / 是 |
| 54 | `querenyijian1` | `text` | `editable` | type=text; kind=editable; name=querenyijian1; allowmultivalues=true | defaultvalue: "" |
| 55 | `guanlichuid` | `text` | `computed` | type=text; kind=computed; name=guanlichuid | defaultvalue: guanlichuid |
| 56 | `ITChecker` | `names` | `computed` | type=names; kind=computed; name=ITChecker | defaultvalue: ITChecker |
| 57 | `querenyijian` | `text` | `computed` | type=text; kind=computed; name=querenyijian | defaultvalue: querenyijian |
| 58 | `sign6` | `names` | `computed` | type=names; kind=computed; name=sign6 | defaultvalue: sign6 |
| 59 | `signtime6` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime6 | defaultvalue: signtime6 |
| 60 | `isLformat` | `keyword` | `editable` | type=keyword; kind=editable; name=isLformat | defaultvalue: "已低格"; keywords: 已低格 / 不需要低格 |
| 61 | `performance` | `keyword` | `editable` | type=keyword; kind=editable; name=performance | defaultvalue: "性能良好"; keywords: 性能良好 / 性能不佳 |
| 62 | `information` | `text` | `editable` | type=text; kind=editable; name=information |  |
| 63 | `sign2` | `names` | `computed` | type=names; kind=computed; name=sign2 | defaultvalue: sign2 |
| 64 | `signtime2` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime2 | defaultvalue: signtime2 |
| 65 | `author` | `authors` | `editable` | type=authors; kind=editable; name=author; allowmultivalues=true | defaultvalue: @UserName |
| 66 | `reader` | `names` | `editable` | type=names; kind=editable; name=reader; allowmultivalues=true | defaultvalue: @UserName |
| 67 | `mark` | `text` | `editable` | type=text; kind=editable; name=mark | defaultvalue: "" |
| 68 | `t1` | `text` | `editable` | type=text; kind=editable; name=t1 |  |
| 69 | `t2` | `number` | `editable` | type=number; kind=editable; name=t2 |  |
| 70 | `author_1` | `authors` | `editable` | type=authors; kind=editable; name=author_1; allowmultivalues=true | defaultvalue: "[管理员]" |
| 71 | `reader_1` | `names` | `editable` | type=names; kind=editable; name=reader_1; allowmultivalues=true | defaultvalue: "[管理员]":"[查询打印]":"[资产转移读]" |
| 72 | `finish` | `datetime` | `editable` | type=datetime; kind=editable; name=finish |  |
| 73 | `finisher` | `names` | `editable` | type=names; kind=editable; name=finisher |  |
| 74 | `server_name` | `text` | `computed` | type=text; kind=computed; name=server_name | defaultvalue: @If(server_name!="";server_name; @Subset(@DbColumn("":"Nocache"; "";"pzb";1);1)) |
| 75 | `data_name` | `text` | `computed` | type=text; kind=computed; name=data_name | defaultvalue: @If(data_name!="";data_name; @Subset(@DbColumn("":"Nocache"; "";"pzb";2);1)) |
| 76 | `region_1` | `text` | `computed` | type=text; kind=computed; name=region_1 | defaultvalue: region |
| 77 | `server_name1` | `text` | `computed` | type=text; kind=computed; name=server_name1 | defaultvalue: @If(server_name1!="";server_name1; @Subset(@DbColumn("":"Nocache"; "";"bmpzb";1);1)) |
| 78 | `data_name1` | `text` | `computed` | type=text; kind=computed; name=data_name1 | defaultvalue: @If(data_name1!="";data_name1; @Subset(@DbColumn("":"Nocache"; "";"bmpzb";2);1)) |
| 79 | `m1` | `text` | `editable` | type=text; kind=editable; name=m1 |  |
| 80 | `m2` | `text` | `editable` | type=text; kind=editable; name=m2 |  |
| 81 | `m3` | `text` | `editable` | type=text; kind=editable; name=m3 |  |
| 82 | `m4` | `text` | `editable` | type=text; kind=editable; name=m4 |  |
| 83 | `m5` | `text` | `editable` | type=text; kind=editable; name=m5 |  |
| 84 | `m6` | `text` | `editable` | type=text; kind=editable; name=m6 |  |
| 85 | `m7` | `text` | `editable` | type=text; kind=editable; name=m7 |  |
| 86 | `m8` | `text` | `editable` | type=text; kind=editable; name=m8 |  |

## 证据边界

- 可直接确认：表单、字段、字段事件、按钮/action、视图选择公式、代理节点、状态字段取值。
- 需要推断：按钮状态赋值组合成的主干流程、`mark` 与归档含义、`current_processor` 与处理人展示关系。
- 不能仅凭 DXL 完全确认：Notes ACL、运行期角色、外部 NSF 查询结果、客户端打印效果、所有隐藏条件与字段的一一映射。
- 本文为从 DXL 恢复生成的分析文档；如需生产发布，还需按缺口分析补齐业务类型、角色、字段映射和条件决策表。
