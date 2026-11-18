# 玄霄问道录 · 九州万法沙盒版

《玄霄问道录》是本地单机文字修仙 RPG。修行纪事和 NPC 记忆随浏览器存档保存，人生存档可导出为 JSON，纪事可导出为 Markdown。

## 启动网页版

在装有 Node.js 的电脑上进入项目目录，依次运行以下命令。

```sh
npm ci
npm run build
npm run preview
```

打开 [本机游戏](http://127.0.0.1:4188/)。Windows 下也可在构建后双击 `Start-Local-Story.cmd`。

## 自由行动与本地模型

1. 新开人生先点「抽签」，从当轮五个命格里最多选三条，再点「踏入仙途」。每次启动共有三次抽签机会。已有进度可以点「继续上次」。
2. 在任一 NPC 的聊天窗口点「载入本地模型」，或在主界面的「自由行动」中点「选择模型文件」，选中本机的 `qwen2.5-1.5b-instruct-q4_k_m.gguf`（约 1.12 GB）。模型可从 [Qwen 官方仓库](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/blob/main/qwen2.5-1.5b-instruct-q4_k_m.gguf)下载。
3. 模型载入后，六位 NPC 都可以自由交谈，人物各自的记忆、查访和约见随存档保留。也可以在「自由行动」写下想做的事。浏览器在本机生成回应。

构建后也可直接打开 `dist/玄霄问道录.html` 游玩基础版本。Android WebView 工程位于 `android/`，`npm run build` 会同步其中的离线网页资源。
