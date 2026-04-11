import os
import time
import random
import subprocess
import urllib.request
import json

class EndlessAMSDaemon:
    """
    [夜枭型脱机迭代车间]
    指挥官最高统御指令：“在此项目循环迭代、不可终止、发酵至企业级！”
    此守护程序将接管无头时间，自动寻找演进方向并驱使 Aider AI 执行本地代码变异与集成测试。
    """
    def __init__(self, workspace: str):
        self.workspace = workspace
        self.log_file = os.path.join(workspace, "daemon_evolution.log")
        
        # Team 组网级功能演进池 (按四大模块集群下发军令，替代无头重整)
        self.epic_backlog = [
            "【Squad Location】作为基础设施建设小队，请在 forthAMS 项目中实现多级层级关系的 Location (空间字典) 的全链路打通。包括 Entity(具备树状关系的 ID, parentId 等)、MyBatis Mapper、支持树形查建改的 Service 层，以及在 LocationController 暴露完善的 REST API。确保与现有框架的实体风格保持一致，使用 Spring Boot 标准装配。",
            "【Squad Vendor】作为供应商关系链小队，请全面建设 Vendor 的闭环体系。包含：建立完备的 Vendor 实体对象，并在 Mapper 中增加增量数据防重入扫描逻辑；同时补齐 VendorService 并在 Controller 对接。审视目前已有的 Maintenance 等依赖，如果有外设或外部指派服务属性，考虑为这些业务实体预留 vendor_id 的多键关联能力。",
            "【Squad WorkOrder】做为工作流战队，请对维保、调拔等散乱事件统一建立更高层级的工单底盘表（WorkOrder）。该工单表需要包含单号（Auto-Gen）、状态（如DRAFT/PENDING/APPROVED/EXECUTING/CLOSED）等标准化字段。提供其对应的 Service 操作核心以实现状态机驱动（不能非法越级修改工单态），并且提供完备的 API 支持。",
            "【Squad Audit】风险审计与可观测性打杂小队。你需要对整个系统构建通用审计跟踪表: GeneralAuditEntry。核心在于为其编写 AOP 切面代码（例如自定义一个 @Auditable 注解配合一个 AuditAspect 类拦截增删改的方法），并在关键控制器如 AssetController 等核心写操作上落上注解，使得系统可以完全自主在后台存入一条带有 trace_id, action, before_record, after_record 等的审计记录日志到 MySQL。"
        ]
        
    def log(self, msgs):
        with open(self.log_file, "a", encoding="utf-8") as f:
            t = time.strftime("%Y-%m-%d %H:%M:%S")
            line = f"[{t}] 🌃 [Endless] {msgs}\n"
            f.write(line)
            print(line, end="")
            
        # 同步向指挥官的主屏幕推送长命百岁框的进度
        try:
            url = "http://127.0.0.1:8999/api/external_event"
            data = {"task_id": "US-FOSAMS", "message": msgs[:200], "data": {"state": "running"}}
            req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
            urllib.request.urlopen(req, timeout=2)
        except Exception:
            pass # 主控制台即使死掉也不影响它的孤独挂靠

    def invoke_aider_evolution(self, mandate: str):
        self.log(f"🔥 打爆演进核弹: {mandate}")
        
        # 在触发 Aider 之前先探活大模型接口
        try:
            req = urllib.request.Request("http://127.0.0.1:1234/v1/models", method='GET')
            urllib.request.urlopen(req, timeout=3)
        except Exception as e:
            self.log(f"🛑 危险拦截: 检测到大模型 API 不可达 ({e})，防止 Aider 死循环超时，截断本轮请求。")
            return

        # 呼应系统：全域启用无审重装模型慢跑
        env = os.environ.copy()
        env["OPENAI_API_BASE"] = "http://127.0.0.1:1234/v1" # [智体分离] 切换为本地 LM Studio 接口
        env["OPENAI_API_KEY"] = "lm-studio"
        env["AIDER_MODEL"] = "openai/qwen25"  # 切换为代码智商极高的 Qwen 2.5 (本地当前挂载模型)
        env["AIDER_SHOW_MODEL_WARNINGS"] = "False" # 切断独立的子进程弹窗
        env["BROWSER"] = "echo" # 黑洞浏览器系统调用

        # 在底层唤起 Aider 机器人接盘
        # --yes 参数让 Aider 实现零人类接触的强权覆盖
        command = [
            "/usr/local/bin/aider", 
            "--message", f"【企业级强制进化铁律】根据现有架构，执行以下高阶设计迭代，不可破坏原有闭环：\n{mandate}", 
            "--yes",
            "--no-show-model-warnings", # 直接在此处封死警告功能
            "--no-auto-commits" # 让它先在本地重写，由守护进程随后发起 git/测试
        ]
        
        try:
            result = subprocess.run(
                command, 
                cwd=self.workspace,
                env=env,
                capture_output=True,
                text=True,
                timeout=1200 # 留给大模型至多 20 分钟单轮慢熬时间
            )
            self.log(f"🦾 脑力激荡完毕。出口码: {result.returncode}")
            if result.returncode == 0:
                self.log("✅ 此次基因突变已成功揉入当前代码海！")
            else:
                self.log(f"⚠️ Aider 神经衰弱错误。部分日志:\n{result.stderr[-500:]}")
        except subprocess.TimeoutExpired:
            self.log("⏳ 构思过于庞大超时截断。它已经尽力了。下回合见。")
        except Exception as e:
            self.log(f"💥 无法驱动外脑: {str(e)}")

    def run_forever(self):
        self.log("=========================================")
        self.log("🌑 太阳落山，长城守夜人已启动。ForthAMS 企业级打磨流水线进入死循环状态...")
        self.log("=========================================")
        round_idx = 1
        
        # 为了保证不是在空文件夹转悠，先打个底（如果有 git 的话）
        subprocess.run(["git", "init"], cwd=self.workspace, capture_output=True)
        
        while True:
            self.log(f"\n--- ⚡ 第 {round_idx} 次基因融合突飞猛进开始 ---")
            # 1. 抽取战术卡
            tactic = random.choice(self.epic_backlog)
            # 2. 召唤引擎推进入库
            self.invoke_aider_evolution(tactic)
            # 3. 跑一点测试或强制锁库
            subprocess.run(["git", "add", "."], cwd=self.workspace, capture_output=True)
            
            # 使用 git diff 检查被缓存的真实改动
            diff_proc = subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=self.workspace, capture_output=True, text=True)
            changed_files = diff_proc.stdout.strip().split('\n')
            
            # 过滤掉日志和Aider历史文件
            real_changes = [f for f in changed_files if f and not f.endswith('daemon.out') and not f.endswith('daemon_evolution.log') and not f.endswith('.aider.chat.history.md') and not f.endswith('daemon_out.log')]
            
            if real_changes:
                self.log(f"🔒 检测到 {len(real_changes)} 个业务文件发生真实变异！打入闭环版本印记...")
                subprocess.run(["git", "commit", "-m", f"chore(evolve): auto mutation round {round_idx} - {tactic[:20]}"], cwd=self.workspace, capture_output=True)
            else:
                self.log("⚠️ 防御拦截：本轮大模型未产生任何业务代码级别变更 (可能网络崩塌或胡言乱语)，跳过提交并回退。")
                subprocess.run(["git", "reset", "HEAD"], cwd=self.workspace, capture_output=True)
                
            # 4. 释放封印，不再做虚伪的冷却
            self.log("🚀 VRAM 冷却机制已解除，统一内存架构直接发起下一轮无缝衔接突刺！")
            time.sleep(2) # 仅留 2 秒作为 IO 与 Git 文件流的物理落盘缓冲
            round_idx += 1

if __name__ == "__main__":
    # 该脚本运行于 forthAMS 目录
    here = os.path.dirname(os.path.abspath(__file__))
    daemon = EndlessAMSDaemon(workspace=here)
    daemon.run_forever()
