# WorkOrder / Retirement 后端闭环验证

## 目标

在工作区分拣后，对两个高价值后端候选切片做只验证不扩展的闭环确认：

- WorkOrder：工单提交、审批流程创建、审批回写。
- Retirement：资产退役/报废申请、审批、资产状态生命周期联动。

## 验证命令

```bash
cd backend
mvn -q -Dtest=WorkOrderServiceTest,WorkOrderControllerTest,ApprovalServiceTest test
mvn -q -Dtest=RetirementApplicationServiceTest,RetirementControllerTest,AssetLifecycleServiceTest test
mvn -q -DskipTests compile
mvn -q test
```

## 结果

| 范围 | 命令 | 结果 |
|---|---|---:|
| WorkOrder 后端闭环 | `mvn -q -Dtest=WorkOrderServiceTest,WorkOrderControllerTest,ApprovalServiceTest test` | 通过 |
| Retirement 后端闭环 | `mvn -q -Dtest=RetirementApplicationServiceTest,RetirementControllerTest,AssetLifecycleServiceTest test` | 通过 |
| 后端编译 | `mvn -q -DskipTests compile` | 通过 |
| 后端全量测试 | `mvn -q test` | 通过 |

## 结论

WorkOrder 与 Retirement 作为后端业务闭环候选切片具备测试通过证据，可以进入后续“分批提交候选”讨论。

## 提交前仍需确认

- 不要把 `.gsd/**`、Python benchmark、Sprint4 测试、运行产物混入该切片。
- `schema.sql` 涉及 DDL，应确认是否与 WorkOrder/Retirement 一起提交，还是拆成独立 DDL/迁移切片。
- `application.properties` 涉及运行配置，应确认默认值和环境变量策略。
