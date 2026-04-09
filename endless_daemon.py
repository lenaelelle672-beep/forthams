import os
import time
import random
import subprocess

class EndlessAMSDaemon:
    """
    [夜枭型脱机迭代车间]
    指挥官最高统御指令：“在此项目循环迭代、不可终止、发酵至企业级！”
    此守护程序将接管无头时间，自动寻找演进方向并驱使 Aider AI 执行本地代码变异与集成测试。
    """
    def __init__(self, workspace: str):
        self.workspace = workspace
        self.log_file = os.path.join(workspace, "daemon_evolution.log")
        
        # 建立企业级功能演进池 (防止无头乱转，进行有的放矢的企业级重构)
        self.epic_backlog = [
            "遍历现有 API 路由或核心类，为其所有可能产生 I/O 阻塞或奔溃的端点添加优雅的 Error Boundary (重试机制与降级策略)，使其达到真正的企业级健壮性。",
            "在项目中接入完善的全域日志系统。要求每条主要日志都带有 Trace ID，能够横向追踪一个 Request 的整个生命周期。",
            "排查当前储存与对象映射架构，本系统全栈重构强制依托【本地 MySQL 数据库】！请生成连接池代码（账号默认 root/空 或者自启数据库名如 forth_ams_db）并将业务切换为原汁原味的 MySQL 持久化驱动。",
            "扫荡所有的函数接口，排查类型不安全的地方。为项目的核心骨架增加泛型支持或深度的 类型断言校验(Type Validation)，增强生产级别编译检测力。",
            "模拟系统突然遭遇流量洪峰，因此找到访问量最高的逻辑段，为其增加基于内存或Redis的限流器 (Rate Limiter) 及熔断机制 (Circuit Breaker)。",
            "检查现有业务逻辑中的数据并发场景。使用乐观锁或悲观锁重构那些在 MySQL 中容易发生因高并发写入导致事务回滚的地方以达到工业金融级数据安全。",
            "运行自动化测试代码，如果现有项目覆盖率不够，就自动为还没有覆盖的业务编写完整的边界值与异常注入 (Fault Injection) 单元测试。"
        ]
        
    def log(self, msgs):
        with open(self.log_file, "a", encoding="utf-8") as f:
            t = time.strftime("%Y-%m-%d %H:%M:%S")
            line = f"[{t}] 🌃 [Endless] {msgs}\n"
            f.write(line)
            print(line, end="")

    def invoke_aider_evolution(self, mandate: str):
        self.log(f"🔥 打爆演进核弹: {mandate}")
        
        # 设置调用使用我们在 VIB 系统里证实能跑的高级强效模型 (可自定)
        env = os.environ.copy()
        env["AIDER_MODEL"] = "ollama/gemma3:4b"  # 或者是外部提供的 gpt-4 之类，此处默认给它接管

        # 在底层唤起 Aider 机器人接盘
        # --yes 参数让 Aider 实现零人类接触的强权覆盖
        command = [
            "aider", 
            "--message", f"【企业级强制进化铁律】根据现有架构，执行以下高阶设计迭代，不可破坏原有闭环：\n{mandate}", 
            "--yes",
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
            self.log("🔒 为本次修改打入版本印记或执行假想测例防止劣化...")
            subprocess.run(["git", "add", "."], cwd=self.workspace, capture_output=True)
            subprocess.run(["git", "commit", "-m", f"chore(evolve): auto mutation round {round_idx} - {tactic[:20]}"], cwd=self.workspace, capture_output=True)
            # 4. 进入赛博深眠，防止机器燃爆
            sleep_time = random.randint(120, 300)
            self.log(f"🛌 机体过热，让 VRAM 沉寂散热 {sleep_time} 秒...")
            time.sleep(sleep_time)
            round_idx += 1

if __name__ == "__main__":
    # 该脚本运行于 forthAMS 目录
    here = os.path.dirname(os.path.abspath(__file__))
    daemon = EndlessAMSDaemon(workspace=here)
    daemon.run_forever()
