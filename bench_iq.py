#!/usr/bin/env python3
import json
import requests
import sys

API_URL = "http://127.0.0.1:8000/v1/chat/completions"
HEADERS = {"Content-Type": "application/json"}

MODELS = [
    "qwen3.6-q6-router",
]

TESTS = [
    {
        "name": "逻辑推理 - 数学",
        "prompt": "A bat and ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost? Answer with just the dollar amount.",
        "answer": "$0.05",
        "check": lambda r: "0.05" in r or "5 cent" in r.lower(),
    },
    {
        "name": "逻辑推理 - 反转",
        "prompt": "If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets? Answer with just the number and unit.",
        "answer": "5 minutes",
        "check": lambda r: "5 minute" in r.lower() or "5 min" in r.lower(),
    },
    {
        "name": "逻辑推理 - 水仙花",
        "prompt": "In a lake, there is a patch of lily pads. Every day, the patch doubles in size. If it takes 48 days for the patch to cover the entire lake, how long would it take for the patch to cover half of the lake? Answer with just the number and unit.",
        "answer": "47 days",
        "check": lambda r: "47" in r,
    },
    {
        "name": "编程 - 离线算法",
        "prompt": 'Write a Python function `find_two_sum(nums, target)` that returns indices of two numbers that add up to target. Use O(n) time complexity. Return ONLY the function code, no explanation.',
        "answer": "hashmap solution",
        "check": lambda r: "dict" in r or "hash" in r.lower() or "enumerate" in r or "map" in r.lower(),
    },
    {
        "name": "编程 - 边界条件",
        "prompt": "Write a Python function that reverses a linked list. Handle the edge case of an empty list. Return ONLY the code.",
        "answer": "iterative/recursive",
        "check": lambda r: "next" in r and ("while" in r or "recurs" in r.lower()) and ("None" in r or "null" in r.lower()),
    },
    {
        "name": "系统设计 - 数据库",
        "prompt": "Design a URL shortener. List the 3 most important database indexes you would create. Be concise, one line per index.",
        "answer": "short_code, user_id, created_at",
        "check": lambda r: ("index" in r.lower() or "key" in r.lower()) and ("short" in r.lower() or "code" in r.lower()),
    },
    {
        "name": "代码审查 - Bug发现",
        "prompt": 'Find the bug in this code:\n```python\ndef binary_search(arr, target):\n    low, high = 0, len(arr)\n    while low < high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1\n```\nExplain the bug in one sentence.',
        "answer": "high should be len(arr)-1 OR while low<=high",
        "check": lambda r: ("len(arr)" in r and "-1" in r) or "low <=" in r or "high =" in r or ("off-by-one" in r.lower() or "out of" in r.lower() or "index" in r.lower()),
    },
    {
        "name": "数学 - 概率",
        "prompt": "You have two fair coins. You flip both. Given that at least one is heads, what is the probability that both are heads? Answer as a fraction.",
        "answer": "1/3",
        "check": lambda r: "1/3" in r or "one third" in r.lower() or "1/3" in r,
    },
    {
        "name": "安全 - SQL注入",
        "prompt": "Show a Python example of a SQL injection vulnerability and the parameterized query fix. Be concise.",
        "answer": "f-string/format + parameterized",
        "check": lambda r: "parameter" in r.lower() or "?" in r or "%s" in r or ("execute" in r.lower() and ("select" in r.lower() or "insert" in r.lower())),
    },
    {
        "name": "推理 - 时序",
        "prompt": "Alice is looking at Bob, but Bob is looking at Charlie. Alice is married, but Charlie is not. Is a married person looking at an unmarried person? Answer Yes, No, or Cannot be determined. Then explain in one sentence.",
        "answer": "Yes",
        "check": lambda r: r.strip().lower().startswith("yes") or "yes" in r.lower()[:50],
    },
    {
        "name": "架构 - 缓存策略",
        "prompt": "Name the 3 most common cache eviction policies used in CDNs. Just list them, one per line.",
        "answer": "LRU, LFU, FIFO",
        "check": lambda r: ("lru" in r.lower() or "least recently" in r.lower()) and ("lfu" in r.lower() or "least frequently" in r.lower()),
    },
    {
        "name": "Python - GIL",
        "prompt": "In one sentence: What is Python's GIL and what is its main impact on multi-threaded programs?",
        "answer": "prevents multiple threads from executing Python bytecode simultaneously",
        "check": lambda r: "thread" in r.lower() and ("gil" in r.lower() or "global interpreter" in r.lower()) and ("simultaneous" in r.lower() or "parallel" in r.lower() or "concurrent" in r.lower() or "one" in r.lower() or "single" in r.lower()),
    },
]


def clean_output(text):
    text = text.strip()
    for prefix in ["<|channel>thought", "<|channel>analysis"]:
        if prefix in text:
            parts = text.split("<|channel>final")
            if len(parts) > 1:
                text = parts[-1].strip()
            else:
                lines = text.split("\n")
                clean_lines = []
                skip = True
                for line in lines:
                    if "<|channel>final" in line or "<|channel>response" in line:
                        skip = False
                        continue
                    if not skip:
                        clean_lines.append(line)
                if clean_lines:
                    text = "\n".join(clean_lines).strip()
    return text[:500]


def call_model(model, prompt):
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 512,
        "temperature": 0.1,
    }
    resp = requests.post(API_URL, headers=HEADERS, json=payload, timeout=300)
    data = resp.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    tokens = data.get("usage", {}).get("completion_tokens", 0)
    return content, tokens


def main():
    results = {m: {"correct": 0, "total": 0, "details": []} for m in MODELS}

    for test in TESTS:
        print(f"\n{'='*60}")
        print(f"TEST: {test['name']}")
        print(f"正确答案: {test['answer']}")
        print(f"{'='*60}")
        for model in MODELS:
            short_name = "qwen3.6" if "qwen" in model else "gemma-4"
            content, tokens = call_model(model, test["prompt"])
            cleaned = clean_output(content)
            passed = test["check"](cleaned)
            mark = "PASS" if passed else "FAIL"
            results[model]["total"] += 1
            if passed:
                results[model]["correct"] += 1
            results[model]["details"].append((test["name"], passed))
            preview = cleaned[:120].replace("\n", " ")
            print(f"  [{short_name:8s}] {mark} | {tokens:4d} tok | {preview}")

    print(f"\n{'='*60}")
    print("IQ BATTLE SCOREBOARD")
    print(f"{'='*60}")
    for model in MODELS:
        short_name = "qwen3.6" if "qwen" in model else "gemma-4"
        r = results[model]
        pct = r["correct"] / r["total"] * 100 if r["total"] > 0 else 0
        print(f"\n  {short_name}: {r['correct']}/{r['total']} ({pct:.0f}%)")
        for name, passed in r["details"]:
            mark = "OK" if passed else "XX"
            print(f"    [{mark}] {name}")

    print(f"\n{'='*60}")
    if len(MODELS) == 1:
        q = results[MODELS[0]]
        pct = q["correct"] / q["total"] * 100 if q["total"] > 0 else 0
        print(f"RESULT: qwen3.6-q6-router {q['correct']}/{q['total']} ({pct:.0f}%)")
    else:
        q = results[MODELS[0]]
        g = results[MODELS[1]]
        if q["correct"] > g["correct"]:
            print("WINNER: qwen3.6-q6-router (智商胜出)")
        elif g["correct"] > q["correct"]:
            print("WINNER: 对照模型 (智商胜出)")
        else:
            print("TIE: 平局")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
