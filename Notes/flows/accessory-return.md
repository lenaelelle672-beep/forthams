# 配件清退流程

来源：`/Users/feigao/Downloads/flow_complete_design.dxl`。

## 关注范围

配件清退申请、部门/主管审批、回收库房确认。

## 入口与表单

| 视图 | 选择公式 | 新建入口 |
| --- | --- | --- |
| 配件清退\按状态 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 配件清退\按申请人ID | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 配件清退\按资产编号 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 配件清退\归档\按完成日期 | `SELECT form="配件清退电子流"&mark="1"` | 配件清退电子流 |
| 配件清退\按填报日期 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 配件清退\按清退部门编码 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |
| 配件清退\归档\按申请人ID | `SELECT form="配件清退电子流"&mark="1"` | 配件清退电子流 |
| 配件清退\归档\按资产编号 | `SELECT form="配件清退电子流"&mark="1"` | 配件清退电子流 |
| 设置\资产核算处id（配件清退） | `SELECT form="zichanchu21"` | zichanchu21 |
| 配件清退\按当前处理人 | `SELECT form="配件清退电子流"&mark=""` | 配件清退电子流 |

## 表单字段与按钮逻辑

### 配件清退电子流

- 默认 businessType：`ACCESSORY_CLEARANCE`
- 表单属性：`nocompose=true; editonopen=true; designerversion=8.5.3; publicaccess=false`
- 字段/按钮/action 数：62 / 12 / 7
- 状态字段证据：`now_status` 相关状态摘要：存为草稿 / 清退部门一级资产管理员审批 / 返回申请人 / 清退部门主管审批 / 等待回收库房确认 / 结束

#### 关键字段

| # | 字段名 | 类型 | kind | 属性摘要 | 默认/转换/校验/关键词摘要 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `wupin` | `text` | `computed` | type=text; kind=computed; name=wupin | defaultvalue: wupin |
| 2 | `zrlID` | `names` | `editable` | type=names; kind=editable; name=zrlID |  |
| 3 | `xinghao1` | `text` | `editable` | type=text; kind=editable; name=xinghao1 | defaultvalue: xinghao1 |
| 4 | `now_status` | `text` | `computed` | type=text; kind=computed; name=now_status | defaultvalue: @If(now_status="";"填写申请";now_status) |
| 5 | `current_processor` | `text` | `computedfordisplay` | type=text; kind=computedfordisplay; name=current_processor | defaultvalue: @Name([CN];Author) |
| 6 | `shenqingid` | `names` | `computedwhencomposed` | type=names; kind=computedwhencomposed; name=shenqingid | defaultvalue: @UserName |
| 7 | `bianhao` | `text` | `computed` | type=text; kind=computed; name=bianhao | defaultvalue: bianhao |
| 8 | `rqi` | `datetime` | `computedwhencomposed` | type=datetime; kind=computedwhencomposed; name=rqi | defaultvalue: @Created |
| 9 | `bianhao1` | `text` | `computed` | type=text; kind=computed; name=bianhao1 | defaultvalue: bianhao1; entering: Sub Entering(Source As Field) Dim uidoc As notesuidocument Dim wks As New notesuiworkspace Dim doc As notesdocument Dim view As notesview Set uidoc=wks.currentdocument Set doc=uid… |
| 10 | `mingcheng1` | `text` | `editable` | type=text; kind=editable; name=mingcheng1 |  |
| 11 | `Num` | `text` | `editable` | type=text; kind=editable; name=Num |  |
| 12 | `keepPlace` | `text` | `editable` | type=text; kind=editable; name=keepPlace |  |
| 13 | `zcrID` | `text` | `computed` | type=text; kind=computed; name=zcrID | defaultvalue: zcrID |
| 14 | `zccpbianhao` | `text` | `computed` | type=text; kind=computed; name=zccpbianhao | defaultvalue: @If(zccpbianhao="";"";zccpbianhao); entering: Sub Entering(Source As Field) Dim uidoc As notesuidocument Dim wks As New notesuiworkspace Dim doc As notesdocument Dim view As notesview Set uidoc=wks.currentdocument Set doc=uid… |
| 15 | `zcbmbm` | `text` | `computed` | type=text; kind=computed; name=zcbmbm | defaultvalue: zcbmbm |
| 16 | `zcbm` | `text` | `computed` | type=text; kind=computed; name=zcbm | defaultvalue: zcbm |
| 17 | `zcren` | `text` | `computed` | type=text; kind=computed; name=zcren | defaultvalue: zcren |
| 18 | `rmangerid` | `names` | `editable` | type=names; kind=editable; name=rmangerid |  |
| 19 | `zrren` | `names` | `computed` | type=names; kind=computed; name=zrren | defaultvalue: zrren |
| 20 | `yuanyin` | `text` | `editable` | type=text; kind=editable; name=yuanyin |  |
| 21 | `remark` | `richtext` | `editable` | type=richtext; kind=editable; name=remark |  |
| 22 | `sign1` | `names` | `computed` | type=names; kind=computed; name=sign1 | defaultvalue: sign1 |
| 23 | `signtime1` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime1 | defaultvalue: signtime1 |
| 24 | `shenpiyijian` | `text` | `editable` | type=text; kind=editable; name=shenpiyijian |  |
| 25 | `aa` | `keyword` | `editable` | type=keyword; kind=editable; name=aa | defaultvalue: "否"; keywords: 否 / 是 |
| 26 | `jiliangyiqi` | `text` | `computed` | type=text; kind=computed; name=jiliangyiqi | defaultvalue: jiliangyiqi |
| 27 | `mangerid1_1` | `keyword` | `editable` | type=keyword; kind=editable; name=mangerid1_1 | defaultvalue: mangerid1_1 |
| 28 | `sign5` | `names` | `computed` | type=names; kind=computed; name=sign5 | defaultvalue: sign5 |
| 29 | `signtime5` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime5 | defaultvalue: signtime5 |
| 30 | `yijian_1` | `text` | `editable` | type=text; kind=editable; name=yijian_1 |  |
| ... | ... | ... | ... | ... | 共 62 个字段，完整字段见全量分析或 DXL |

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
| button | (无显示文本/图标按钮) | 选择视图 一级资源管理员ID |
| button | (无显示文本/图标按钮) | 状态->存为草稿 |
| button | (无显示文本/图标按钮) | 状态->清退部门一级资产管理员审批; 校验/提示 请输入资产编号 / 请输入配件名称 / 请输入所缺配件 / 请指定直接主管ID / 请指定部门资产管理员ID; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->返回申请人; 校验/提示 请填写审批意见; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->清退部门主管审批; 校验/提示 请输入审批意见; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->返回申请人; 校验/提示 请填写审批意见; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->等待回收库房确认; 校验/提示 请输入审批意见; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->返回申请人; 校验/提示 请填写不接受原因; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->结束; 校验/提示 请提供所缺配件记录; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->返回申请人; 校验/提示 请填写审批意见; 含邮件/通知逻辑 |
| button | (无显示文本/图标按钮) | 状态->清退部门一级资产管理员审批; 校验/提示 请输入审批意见; 含邮件/通知逻辑 |

推断主线：`存为草稿 -> 清退部门一级资产管理员审批 -> 返回申请人 -> 清退部门主管审批 -> 等待回收库房确认 -> 结束`。

## 流程图走向（推断）

```mermaid
flowchart TD
    F1_0["配件清退电子流: 开始"]
    F1_1["存为草稿"]
    F1_0 --> F1_1
    F1_2["清退部门一级资产管理员审批"]
    F1_1 --> F1_2
    F1_3["返回申请人"]
    F1_2 --> F1_3
    F1_4["清退部门主管审批"]
    F1_3 --> F1_4
    F1_5["等待回收库房确认"]
    F1_4 --> F1_5
    F1_6["结束"]
    F1_5 --> F1_6
```

## 字段明细

### 字段明细：配件清退电子流

| # | 字段名 | 类型 | kind | 属性摘要 | 默认/转换/校验/关键词摘要 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `wupin` | `text` | `computed` | type=text; kind=computed; name=wupin | defaultvalue: wupin |
| 2 | `zrlID` | `names` | `editable` | type=names; kind=editable; name=zrlID |  |
| 3 | `xinghao1` | `text` | `editable` | type=text; kind=editable; name=xinghao1 | defaultvalue: xinghao1 |
| 4 | `now_status` | `text` | `computed` | type=text; kind=computed; name=now_status | defaultvalue: @If(now_status="";"填写申请";now_status) |
| 5 | `current_processor` | `text` | `computedfordisplay` | type=text; kind=computedfordisplay; name=current_processor | defaultvalue: @Name([CN];Author) |
| 6 | `shenqingid` | `names` | `computedwhencomposed` | type=names; kind=computedwhencomposed; name=shenqingid | defaultvalue: @UserName |
| 7 | `bianhao` | `text` | `computed` | type=text; kind=computed; name=bianhao | defaultvalue: bianhao |
| 8 | `rqi` | `datetime` | `computedwhencomposed` | type=datetime; kind=computedwhencomposed; name=rqi | defaultvalue: @Created |
| 9 | `bianhao1` | `text` | `computed` | type=text; kind=computed; name=bianhao1 | defaultvalue: bianhao1; entering: Sub Entering(Source As Field) Dim uidoc As notesuidocument Dim wks As New notesuiworkspace Dim doc As notesdocument Dim view As notesview Set uidoc=wks.currentdocument Set doc=uid… |
| 10 | `mingcheng1` | `text` | `editable` | type=text; kind=editable; name=mingcheng1 |  |
| 11 | `Num` | `text` | `editable` | type=text; kind=editable; name=Num |  |
| 12 | `keepPlace` | `text` | `editable` | type=text; kind=editable; name=keepPlace |  |
| 13 | `zcrID` | `text` | `computed` | type=text; kind=computed; name=zcrID | defaultvalue: zcrID |
| 14 | `zccpbianhao` | `text` | `computed` | type=text; kind=computed; name=zccpbianhao | defaultvalue: @If(zccpbianhao="";"";zccpbianhao); entering: Sub Entering(Source As Field) Dim uidoc As notesuidocument Dim wks As New notesuiworkspace Dim doc As notesdocument Dim view As notesview Set uidoc=wks.currentdocument Set doc=uid… |
| 15 | `zcbmbm` | `text` | `computed` | type=text; kind=computed; name=zcbmbm | defaultvalue: zcbmbm |
| 16 | `zcbm` | `text` | `computed` | type=text; kind=computed; name=zcbm | defaultvalue: zcbm |
| 17 | `zcren` | `text` | `computed` | type=text; kind=computed; name=zcren | defaultvalue: zcren |
| 18 | `rmangerid` | `names` | `editable` | type=names; kind=editable; name=rmangerid |  |
| 19 | `zrren` | `names` | `computed` | type=names; kind=computed; name=zrren | defaultvalue: zrren |
| 20 | `yuanyin` | `text` | `editable` | type=text; kind=editable; name=yuanyin |  |
| 21 | `remark` | `richtext` | `editable` | type=richtext; kind=editable; name=remark |  |
| 22 | `sign1` | `names` | `computed` | type=names; kind=computed; name=sign1 | defaultvalue: sign1 |
| 23 | `signtime1` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime1 | defaultvalue: signtime1 |
| 24 | `shenpiyijian` | `text` | `editable` | type=text; kind=editable; name=shenpiyijian |  |
| 25 | `aa` | `keyword` | `editable` | type=keyword; kind=editable; name=aa | defaultvalue: "否"; keywords: 否 / 是 |
| 26 | `jiliangyiqi` | `text` | `computed` | type=text; kind=computed; name=jiliangyiqi | defaultvalue: jiliangyiqi |
| 27 | `mangerid1_1` | `keyword` | `editable` | type=keyword; kind=editable; name=mangerid1_1 | defaultvalue: mangerid1_1 |
| 28 | `sign5` | `names` | `computed` | type=names; kind=computed; name=sign5 | defaultvalue: sign5 |
| 29 | `signtime5` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime5 | defaultvalue: signtime5 |
| 30 | `yijian_1` | `text` | `editable` | type=text; kind=editable; name=yijian_1 |  |
| 31 | `sign3` | `text` | `computed` | type=text; kind=computed; name=sign3 | defaultvalue: sign3 |
| 32 | `signtime3` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime3 | defaultvalue: signtime3 |
| 33 | `yijian2` | `text` | `editable` | type=text; kind=editable; name=yijian2 |  |
| 34 | `aa_1` | `keyword` | `editable` | type=keyword; kind=editable; name=aa_1 | defaultvalue: "否"; keywords: 否 / 是 |
| 35 | `querenyijian` | `text` | `editable` | type=text; kind=editable; name=querenyijian |  |
| 36 | `guanlichuid` | `text` | `computedwhencomposed` | type=text; kind=computedwhencomposed; name=guanlichuid | defaultvalue: list:=@DbColumn("":"";@DbName;"zichanchu21";1); @If(@IsError(list);"";@Subset(list;1)) |
| 37 | `sign6` | `names` | `computed` | type=names; kind=computed; name=sign6 | defaultvalue: sign6 |
| 38 | `signtime6` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime6 | defaultvalue: signtime6 |
| 39 | `yijian` | `text` | `editable` | type=text; kind=editable; name=yijian |  |
| 40 | `sign2` | `names` | `computed` | type=names; kind=computed; name=sign2 | defaultvalue: sign2 |
| 41 | `signtime2` | `datetime` | `computed` | type=datetime; kind=computed; name=signtime2 | defaultvalue: signtime2 |
| 42 | `author` | `authors` | `editable` | type=authors; kind=editable; name=author; allowmultivalues=true | defaultvalue: @UserName |
| 43 | `reader` | `names` | `editable` | type=names; kind=editable; name=reader; allowmultivalues=true | defaultvalue: @UserName |
| 44 | `mark` | `text` | `editable` | type=text; kind=editable; name=mark | defaultvalue: "" |
| 45 | `t1` | `text` | `editable` | type=text; kind=editable; name=t1 |  |
| 46 | `t2` | `number` | `editable` | type=number; kind=editable; name=t2 |  |
| 47 | `author_1` | `authors` | `editable` | type=authors; kind=editable; name=author_1; allowmultivalues=true | defaultvalue: "[管理员]" |
| 48 | `reader_1` | `names` | `editable` | type=names; kind=editable; name=reader_1; allowmultivalues=true | defaultvalue: "[管理员]":"[查询打印]":"[资产转移读]" |
| 49 | `finish` | `datetime` | `editable` | type=datetime; kind=editable; name=finish |  |
| 50 | `finisher` | `names` | `editable` | type=names; kind=editable; name=finisher |  |
| 51 | `server_name` | `text` | `computed` | type=text; kind=computed; name=server_name | defaultvalue: @If(server_name!="";server_name; @Subset(@DbColumn("":"Nocache"; "";"pzb";1);1)) |
| 52 | `data_name` | `text` | `computed` | type=text; kind=computed; name=data_name | defaultvalue: @If(data_name!="";data_name; @Subset(@DbColumn("":"Nocache"; "";"pzb";2);1)) |
| 53 | `server_name1` | `text` | `computed` | type=text; kind=computed; name=server_name1 | defaultvalue: @If(server_name1!="";server_name1; @Subset(@DbColumn("":"Nocache"; "";"bmpzb";1);1)) |
| 54 | `data_name1` | `text` | `computed` | type=text; kind=computed; name=data_name1 | defaultvalue: @If(data_name1!="";data_name1; @Subset(@DbColumn("":"Nocache"; "";"bmpzb";2);1)) |
| 55 | `m1` | `text` | `editable` | type=text; kind=editable; name=m1 |  |
| 56 | `m2` | `text` | `editable` | type=text; kind=editable; name=m2 |  |
| 57 | `m3` | `text` | `editable` | type=text; kind=editable; name=m3 |  |
| 58 | `m4` | `text` | `editable` | type=text; kind=editable; name=m4 |  |
| 59 | `m5` | `text` | `editable` | type=text; kind=editable; name=m5 |  |
| 60 | `m6` | `text` | `editable` | type=text; kind=editable; name=m6 |  |
| 61 | `m7` | `text` | `editable` | type=text; kind=editable; name=m7 |  |
| 62 | `m8` | `text` | `editable` | type=text; kind=editable; name=m8 |  |

## 证据边界

- 可直接确认：表单、字段、字段事件、按钮/action、视图选择公式、代理节点、状态字段取值。
- 需要推断：按钮状态赋值组合成的主干流程、`mark` 与归档含义、`current_processor` 与处理人展示关系。
- 不能仅凭 DXL 完全确认：Notes ACL、运行期角色、外部 NSF 查询结果、客户端打印效果、所有隐藏条件与字段的一一映射。
- 本文为从 DXL 恢复生成的分析文档；如需生产发布，还需按缺口分析补齐业务类型、角色、字段映射和条件决策表。
