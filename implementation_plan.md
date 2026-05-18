# GSD System Evolution: 引入 Tool Calling 解析架构

正如长官所察觉到的，完全没有必要和模型在纯文本的“字符串替换匹配”或“正则提取”中死磕！Claude、Cursor 和我（Antigravity）能够精准抓取而不出错，根本原因在于我们不是“用肉眼去看文本”，而是直接**使用了 Tool Calling（工具调用）和结构强绑定**。

本计划将引导整个 GSD 引擎完成从文本抽取向 **Schema Enforcement（协议层强约束）** 的进化。

## User Review Required

> [!IMPORTANT]
> 这是一个底层引擎范式的转变。长官能否批准我修改底层的 `LLMClient` 驱动，并在路由层强迫模型使用类似 `submit_file_paths(files=["XXX"])` 的函数进行通信？这个改动会使后续针对其他任务（如发散式路由、参数搜集）变得像原生 API 一样稳定。您是否同意此构想？

## 方案选型评估 (成熟组件替代)

在 Python 生态中，目前有两大主流途径来实现“模型即工具”的强结构返回：

### 方案 A：直接升级 `llm_client.py` 拥抱原生 `tools` (推荐)
因为现在的接口大都兼容 OpenAI 统一样式，我们可以扩写底层的请求 Payload，向其中下挂一个 `tools` 参数。
模型不再回复 `[文件1, 文件2]` 的长篇大论，而是触发底层的工具事件 `tool_calls`。我们只需要提取 JSON。

### 方案 B：引入神级库 `Instructor` (需轻微改造)
`Instructor` 是当下 GitHub 极其火爆的库（为 Pydantic + LLM 专门打补丁）。通过构建例如：
```python
class TargetFileList(BaseModel):
    files: List[str] = Field(description="必须修改的文件路径集合")
```
它会在底层接管所有的异常重试与解析动作，确保我们只拿到符合该数据类格式的输出。

## Proposed Changes

### [Vibe Core Network]

#### [MODIFY] [llm_client.py](file:///Users/feigao/project/Project/GSD/vib-coding-harness/src/utils/llm_client.py)
- **目标**: 将单一的字符串聊天 (`_call_api`) 扩展。允许 `generate()` 方法接收一个新参数：`response_format_schema: dict = None`。
- **机制**: 当传入该参数时，直接将它组装到给大模型发包 Payload 的 `tools` 字段中（配置为 `function` calling 类型），并强行要求 `tool_choice`。此时模型连说废话的机会都没有，它必须用 JSON 填充函数参数池。

#### [MODIFY] [gsd_orchestrator.py](file:///Users/feigao/project/Project/GSD/vib-coding-harness/src/core/gsd_orchestrator.py)
- **目标**: 撤除我们刚才刚装上的**防弹正则表达式**。
- **机制**: 在第一阶段点火切分提取文件时，不再向大模型发“请你用逗号分隔返回”这种自然语言命令。而是直接下发一个 JSON Schema 工具说明书 `{"name": "submit_extracted_files", "parameters": { "path": "array" }}`。大模型的返回会被 JSON.loads 瞬间捕捉并且 100% 精确，像工业机器齿轮一样严丝合缝。

## 预期成效
1. **百分百防御乱丢标号和解释文本**：模型会清楚知道它在“调用一台机器”，而非回你的微信。
2. **无需补全缩短和强正则匹配**：您将得到最干净优雅的 Array 或 Object 取值方式，彻底终结格式漂移病！
