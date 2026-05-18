#!/usr/bin/env python3
import time
import json
import statistics
import concurrent.futures
import requests
import sys

MODEL = "qwen3.6-q6-router"
API_URL = "http://127.0.0.1:8000/v1/chat/completions"
HEADERS = {"Content-Type": "application/json"}

TTFT_THRESHOLD = 5.0
TPS_THRESHOLD = 10.0


def call_llm(messages, max_tokens=512, temperature=0.7, stream=False):
    payload = {
        "model": MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": stream,
    }
    t0 = time.perf_counter()
    resp = requests.post(API_URL, headers=HEADERS, json=payload, timeout=300)
    t1 = time.perf_counter()
    elapsed = t1 - t0
    data = resp.json()
    content = ""
    usage = {}
    if "choices" in data and len(data["choices"]) > 0:
        content = data["choices"][0].get("message", {}).get("content", "")
    if "usage" in data:
        usage = data["usage"]
    return {"content": content, "elapsed": elapsed, "usage": usage, "raw": data}


def call_llm_stream(messages, max_tokens=256):
    payload = {
        "model": MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
        "stream": True,
    }
    t0 = time.perf_counter()
    ttft = None
    tokens_counted = 0
    with requests.post(API_URL, headers=HEADERS, json=payload, stream=True, timeout=300) as resp:
        for line in resp.iter_lines():
            if not line:
                continue
            line = line.decode("utf-8", errors="ignore")
            if not line.startswith("data: "):
                continue
            chunk = line[6:]
            if chunk.strip() == "[DONE]":
                break
            try:
                obj = json.loads(chunk)
                delta = obj.get("choices", [{}])[0].get("delta", {})
                content = delta.get("content", "") or delta.get("reasoning_content", "")
                if content:
                    tokens_counted += 1
                    if ttft is None:
                        ttft = time.perf_counter() - t0
            except json.JSONDecodeError:
                pass
    total_time = time.perf_counter() - t0
    return {"ttft": ttft, "total_time": total_time, "chunks": tokens_counted}


def bench_simple():
    print("\n" + "=" * 60)
    print("TEST 1: Simple Q&A (short response)")
    print("=" * 60)
    prompts = [
        "What is 2+2? Answer with just the number.",
        "What is the capital of France? One word answer.",
        "What color is the sky on a clear day? One word.",
        "What is 10 * 5? Answer with just the number.",
        "What planet do we live on? One word.",
    ]
    latencies = []
    for i, p in enumerate(prompts):
        r = call_llm([{"role": "user", "content": p}], max_tokens=64, temperature=0.1)
        comp_tokens = r["usage"].get("completion_tokens", 0)
        tps = comp_tokens / r["elapsed"] if r["elapsed"] > 0 else 0
        latencies.append(r["elapsed"])
        print(f"  [{i+1}] {r['elapsed']:.2f}s | {comp_tokens} tok | {tps:.1f} tok/s | {r['content'][:60]}")
    avg = statistics.mean(latencies)
    print(f"  AVG: {avg:.2f}s | MIN: {min(latencies):.2f}s | MAX: {max(latencies):.2f}s")
    return latencies


def bench_reasoning():
    print("\n" + "=" * 60)
    print("TEST 2: Reasoning (code generation)")
    print("=" * 60)
    prompt = (
        "Write a Python function that takes a list of integers and returns "
        "a dictionary with 'min', 'max', 'avg' keys. Include type hints and a docstring."
    )
    r = call_llm([{"role": "user", "content": prompt}], max_tokens=512)
    comp_tokens = r["usage"].get("completion_tokens", 0)
    prompt_tokens = r["usage"].get("prompt_tokens", 0)
    tps = comp_tokens / r["elapsed"] if r["elapsed"] > 0 else 0
    print(f"  Time: {r['elapsed']:.2f}s")
    print(f"  Prompt tokens: {prompt_tokens}")
    print(f"  Completion tokens: {comp_tokens}")
    print(f"  Throughput: {tps:.1f} tok/s")
    print(f"  Output preview:")
    for line in r["content"][:300].split("\n"):
        print(f"    {line}")
    return r


def bench_long_context():
    print("\n" + "=" * 60)
    print("TEST 3: Long context (summarization)")
    print("=" * 60)
    lorem = (
        "Artificial intelligence has transformed many industries. "
        "Machine learning models can now process natural language, generate images, "
        "and even write code. The rapid advancement in transformer architectures "
        "has led to models with billions of parameters. These models require "
        "significant computational resources for training and inference. "
    ) * 20
    prompt = f"Summarize the following text in exactly 3 bullet points:\n\n{lorem}"
    r = call_llm([{"role": "user", "content": prompt}], max_tokens=256)
    comp_tokens = r["usage"].get("completion_tokens", 0)
    prompt_tokens = r["usage"].get("prompt_tokens", 0)
    tps = comp_tokens / r["elapsed"] if r["elapsed"] > 0 else 0
    print(f"  Input tokens: {prompt_tokens}")
    print(f"  Output tokens: {comp_tokens}")
    print(f"  Time: {r['elapsed']:.2f}s")
    print(f"  Throughput: {tps:.1f} tok/s")
    print(f"  Output:\n{r['content'][:400]}")
    return r


def bench_ttft():
    print("\n" + "=" * 60)
    print("TEST 4: Time-to-First-Token (TTFT)")
    print("=" * 60)
    results = []
    for i in range(5):
        r = call_llm_stream([{"role": "user", "content": "Explain quantum computing in 2 sentences."}], max_tokens=128)
        results.append(r)
        ttft_str = f"{r['ttft']:.3f}s" if r["ttft"] is not None else "N/A"
        print(f"  [{i+1}] TTFT: {ttft_str} | Total: {r['total_time']:.2f}s | Chunks: {r['chunks']}")
    ttfts = [r["ttft"] for r in results if r["ttft"] is not None]
    if ttfts:
        avg_ttft = statistics.mean(ttfts)
        print(f"  AVG TTFT: {avg_ttft:.3f}s | MIN: {min(ttfts):.3f}s | MAX: {max(ttfts):.3f}s")
        status = "PASS" if avg_ttft < TTFT_THRESHOLD else "SLOW"
        print(f"  Verdict: {status} (threshold: {TTFT_THRESHOLD}s)")
    return results


def bench_concurrent():
    print("\n" + "=" * 60)
    print("TEST 5: Concurrent requests (2 / 4 / 8)")
    print("=" * 60)
    prompt_msg = [{"role": "user", "content": "Write a haiku about programming."}]

    for concurrency in [2, 4, 8]:
        times = []
        t0_all = time.perf_counter()
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = [pool.submit(call_llm, prompt_msg, 128, 0.7) for _ in range(concurrency)]
            for f in concurrent.futures.as_completed(futures):
                r = f.result()
                times.append(r["elapsed"])
        wall_time = time.perf_counter() - t0_all
        avg = statistics.mean(times)
        total_tokens = 0
        for t in times:
            total_tokens += int(128 * 0.7)
        print(f"  Concurrency={concurrency}: wall={wall_time:.2f}s | avg_req={avg:.2f}s | "
              f"max_req={max(times):.2f}s | throughput={concurrency / wall_time:.2f} req/s")
    return times


def bench_gsd_simulation():
    print("\n" + "=" * 60)
    print("TEST 6: GSD Builder simulation (patch generation)")
    print("=" * 60)
    prompt = (
        "You are an expert Python developer. Given the following file content, "
        "add a new endpoint GET /api/v1/audit-logs that returns paginated audit log entries.\n\n"
        "File: src/api/v1/router.py\n"
        "```python\n"
        "from fastapi import APIRouter\n"
        "router = APIRouter()\n"
        "@router.get('/health')\n"
        "def health():\n"
        "    return {'status': 'ok'}\n"
        "```\n\n"
        "Respond with ONLY the modified file content, no explanations."
    )
    r = call_llm([{"role": "user", "content": prompt}], max_tokens=512)
    comp_tokens = r["usage"].get("completion_tokens", 0)
    tps = comp_tokens / r["elapsed"] if r["elapsed"] > 0 else 0
    print(f"  Time: {r['elapsed']:.2f}s")
    print(f"  Output tokens: {comp_tokens}")
    print(f"  Throughput: {tps:.1f} tok/s")
    print(f"  Output preview:")
    for line in r["content"][:400].split("\n"):
        print(f"    {line}")
    return r


def main():
    print(f"Model: {MODEL}")
    print(f"API: {API_URL}")
    print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    t_start = time.perf_counter()

    bench_simple()
    bench_reasoning()
    bench_long_context()
    bench_ttft()
    bench_concurrent()
    bench_gsd_simulation()

    t_total = time.perf_counter() - t_start
    print("\n" + "=" * 60)
    print(f"BENCHMARK COMPLETE | Total wall time: {t_total:.1f}s")
    print("=" * 60)


if __name__ == "__main__":
    main()
