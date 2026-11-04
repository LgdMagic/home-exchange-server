---
description: How to start/restart long-running processes (dev server etc.) in this project
alwaysApply: true
---

# 启动长期运行进程（dev server 等）的正确方式

**不要**用手动后台方式启动 `npm run dev` / 任何长期运行的服务，例如：

```bash
# ❌ 不要这样做：每次 Shell 工具开新会话时，这些进程会被回收/杀掉，
# 哪怕用了 nohup/disown 也没用（macOS 环境下 setsid 也不可用）。
nohup npm run dev > /tmp/server.log 2>&1 &
disown
```

**正确做法**：直接调用命令本身，并把 Shell 工具的 `block_until_ms` 设为 `0`，
让工具自己的后台任务机制管理这个进程（它能跨多次 Shell 调用持续存活）：

```
Shell(command: "cd <project-dir> && npm run dev", block_until_ms: 0)
```

之后用 `curl -s http://localhost:3000/health` 或新的 Shell/AwaitShell 调用轮询确认启动成功，
不需要反复折腾 nohup/setsid/手动进程管理那一套。

如果端口已被占用（之前残留的进程），先用 `lsof -i :3000` 确认，必要时 `kill <pid>`，
然后照上面方式重新启动一次即可，不要多次重复尝试手动后台方案。
