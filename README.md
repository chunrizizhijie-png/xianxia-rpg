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

1. 点「踏入仙途」或「继续上次」进入游戏。主界面上方的行动区中，「自由行动」在「歇息一日」左侧。
2. 点「自由行动 → 选择模型文件」，选中本机的 `qwen2.5-1.5b-instruct-q4_k_m.gguf`（约 1.12 GB）。模型可从 [Qwen 官方仓库](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/blob/main/qwen2.5-1.5b-instruct-q4_k_m.gguf)下载。
3. 文件载入后，可以写想采取的行动，也可以在 NPC 对话框里输入自己的话。浏览器在本机生成回应。

构建后也可直接打开 `dist/玄霄问道录.html` 游玩基础版本。Android WebView 工程位于 `android/`，`npm run build` 会同步其中的离线网页资源。
