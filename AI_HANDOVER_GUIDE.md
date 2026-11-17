# 《玄霄问道录 · 九州万法沙盒版 (v3.0)》工程架构与 AI 接手开发说明书 (`AI_HANDOVER_GUIDE.md`)

> **致后续接手的 AI 工程师 / 数值策划（Codex / Claude / Gemini / GPT）**：
> 当你接手本项目时，请**务必最先完整阅读本文件**以及 `src/types/game.ts`、`src/data/worldSandbox.ts` 与 `src/engine/gameEngine.ts`。本项目是一款零后端依赖、纯数据驱动的暗黑水墨古风修仙单机 RPG，同时维护 **Vite + React + TypeScript 模块化工程** 与 **Android 原生 WebView 离线 APK 工程**。

---

## 一、 项目目录结构与核心文件职责

```text
xianxia-rpg/
├── AI_HANDOVER_GUIDE.md          # 【必读】本接手开发说明书（架构、公式、数据协议、扩展规范）
├── package.json                  # Vite + React 18 + TypeScript + Tailwind CSS + lucide-react
├── capacitor.config.json         # Capacitor 跨平台封装配置
├── build_apk.bat / build_apk.sh  # Windows / Linux / macOS 本地一键构建 Android APK 脚本
├── .github/workflows/build-apk.yml # GitHub Actions 云端免环境自动编译 APK 工作流
├── android/                      # 完整 Android Studio 原生全屏 WebView 工程
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/xianxia/rpg/MainActivity.java
│       └── assets/www/index.html # 预置的单文件离线可玩生产包（无需跑 npm 即可直接打 APK）
└── src/
    ├── types/
    │   └── game.ts               # 全局核心 TypeScript 类型定义（境界、功法、丹药、女修、事件、战斗）
    ├── data/                     # 纯数据层（JSON 兼容，与引擎逻辑完全解耦）
    │   ├── realms.ts             # 炼气 1~9 层 -> 筑基 -> 金丹 -> 元婴（含各阶破境丹要求与基准神识）
    │   ├── itemsAndSkills.ts     # 15 种阶梯丹药/法宝/礼物 + 10 种带战术连招机制的核心功法 + 6 类强敌
    │   ├── characters.ts         # 首发 3 位核心女修（沈清秋、夜琉璃、林婉儿）完整对话树与专属双修剧本
    │   ├── worldSandbox.ts       # 九州 6 大疆域、8 种炼器灵材、6 大流派羁绊、后 3 位女修（慕清歌、敖霜华、苏星河）及自创/合成功法词缀池
    │   └── events.ts             # 18+ 分支奇遇事件（秘境夺宝、鬼市捡漏、同门暗算、修罗场、心魔劫）
    ├── engine/                   # 纯函数确定性游戏引擎
    │   ├── gameEngine.ts         # 修炼倍率、相对神识突破率公式、战术回合制战斗结算、按境界比例缩放的双修系统
    │   └── livingWorldEngine.ts  # 鲜活 NPC 自主演化 AI、主动上门拜访/血书求救弹窗生成、高危驰援/夺宝/实战切磋生成器
    ├── components/               # 暗黑古风 UI 组件层
    │   ├── TopStatusBar.tsx      # 顶部状态栏（寿元进度条、境界、内伤、攻防神识气运、设置入口）
    │   ├── PortraitStage.tsx     # 右侧常驻女修半身立绘舞台（支持 /portraits/{id}_{emotion}.png 与 SVG 水墨剪影优雅兜底）
    │   ├── SandboxHubPanel.tsx   # 九州沙盒中枢（鲜活 NPC 生态介入、藏经阁自创/合成/流派羁绊、丹器造化炉、九州地图）
    │   ├── ImmortalBondPanel.tsx # 仙缘洞府（千人千面多分支对话抽屉、赠礼、实战邀战切磋、专属双修画卷）
    │   ├── BattlePanel.tsx       # 回合制文字战报面板（显示剑意层数、麻痹控制、丹毒层数、护盾与智能连招 AI）
    │   ├── BreakthroughModal.tsx # 渡劫突破面板（自动识别当前境界专属破境丹、显示道侣护法加成与失败折寿惩罚）
    │   ├── EventModal.tsx        # 奇遇与 NPC 主动上门交互弹窗
    │   ├── InventoryAndSkillsPanel.tsx # 功法词条装配、储物袋、仙宗坊市
    │   ├── SettingsAndHotReloadModal.tsx # 3 槽位存档、JSON 导入导出、运行时剧情/角色 JSON 热扩展器
    │   ├── CharacterCreationModal.tsx # 开局立道号、选灵根、掷先天命格
    │   └── EpitaphModal.tsx      # 寿元耗尽或战败陨落后的生平碑文结算
    └── App.tsx                   # 顶层状态容器与生命周期管理
```

---

## 二、 v3.0 核心数值体系与机制说明（严禁退化回旧版简单逻辑）

### 1. 突破渡劫成功率公式与阶梯破境丹（解决“后期无丹药突破率依然虚高”问题）
- **旧版缺陷（已废弃）**：旧版直接用 `player.sense * 0.18` 加成突破率，导致中后期神识破百后裸冲成功率接近 100%，且全程只认筑基丹。
- **v3.0 现行严格公式 (`calculateBreakthroughRate` in `src/engine/gameEngine.ts`)**：
  1. **神识差值修正**：比较玩家当前神识与当前境界基准神识 `realm.baseSense`：
     `senseMod = clamp(Math.floor((player.sense - realm.baseSense) * 0.25), -15, +12)`。
  2. **大境界天堑基础率极低**：
     - 炼气九层 → 筑基初期：基础率 **24%**，必须对症投入 **【筑基丹 (`foundation_pill`)】(+35%)**。
     - 筑基后期 → 金丹初期：基础率 **14%**，普通筑基丹无效，必须投入 **【结金丹 (`golden_core_pill`)】(+36%)**（可用 `天山雪莲 + 天狐媚珠` 在造化炉炼制，或从金甲傀儡/NPC交易获取）。
     - 金丹后期 → 元婴初期：基础率 **8%**，必须投入 **【九转化婴丹 (`nascent_soul_pill`)】(+38%)**（可用 `周天星辰砂 + 天狐媚珠/千年血参` 炼制）并配合 **道侣双修元阴护持 (+10%~20%)** 与 **护心丹 (+12%)**！
     - 筑基/金丹小境界突破：推荐使用 **【破障丹 (`barrier_break_pill`)】(+22%)**（可用 `千年血参 + 天山雪莲` 炼制）。

### 2. 鲜活 NPC 自治生态与高风险因果交互（解决“情缘像挂件、夺宝无风险、不主动弹窗”问题）
- **主动上门与危机弹窗 (`simulateWorldTick` in `src/engine/livingWorldEngine.ts`)**：
  - 每次玩家闭关、采集或历练推进时间，除刷新 6 位女修在九州各地的境界与动态外，有 **38% 概率直接弹出该女修的主动交互事件弹窗 (`proactiveVisitEvents`)**：例如沈清秋雪夜送药论剑、夜琉璃子夜翻窗撩拨或带伤躲避追杀、林婉儿送百草灵膳、慕清歌月下抚琴镇心魔、敖霜华傲娇投喂、苏星河夜观星象送改命符。
- **高风险介入机缘 (`buildInterveneEvent` in `src/engine/livingWorldEngine.ts`)**：
  - 点击 NPC 动态卡上的 `⚡ 御剑驰援(高危)` / `⚡ 结伴夺宝(险境)` / `⚡ 护法渡劫(雷劫)` 不再是无脑白送奖励，而是弹出**多分支高风险抉择弹窗**：
    - 可选择**正面迎战强敌 Boss**（进入真实回合制战斗，战胜得高阶破境丹与大量好感，战败则重伤乃至陨落）；
    - 可选择**燃烧自身 30% 气血硬抗杀阵**；
    - 在结伴夺宝中甚至可以选择**【杀人夺宝·独吞丹匣】**（瞬间暴富拿走破境金丹，但遭女修反击受伤且好感暴跌 -45、立绘直接切换为 `blackened` 道心黑化状态！）。
- **实战切磋 (`createSparEnemyFromCharacter`)**：
  - 随时可与任意女修进行 1v1 实战切磋（点到为止，战败保留 15% 气血不致死，战胜可赢取她身上的破境丹与好感）。

### 3. 千人千面深度对话树与动态比例双修（解决“对话单调、双修修为鸡肋且台词重复”问题）
- **专属多分支对话 (`CharacterData.chatOptions`)**：
  - 每位女修拥有 3~4 个契合其性格与流派的专属对话选项（含攻击/神识/魅力/气运检定与最低好感门槛），不同女修对调侃、论道、关怀的反馈截然不同。
- **动态境界缩放双修 + 多幕专属剧情 (`interactWithCharacter` & `dualCultivationScenes`)**：
  - 双修修为收益公式：`Math.round(currentRealm.maxExp * 0.28) + (npcRealmIndex > player.realmIndex ? Math.round(currentRealm.maxExp * 0.14) : 0)`。无论是炼气期还是元婴期，每次双修都能稳定推进约 **28%~42% 的当前境界进度条**，并附加 **下次突破成功率 +10% (`nextBreakthroughBonus`)** 与全状态恢复！
  - 每位女修均配置了 **4 幕完全不重样的长篇唯美双修叙事文本 (`dualCultivationScenes`)**，按 `dualCount` 轮换展示在专属的【双修共鸣画卷弹窗】中，绝不出现不同角色共用同一句台词的情况。

### 4. 功法战术连招机制与藏经阁推演（解决“功法同质化、缺乏策略”问题）
- **五大核心战斗机制 (`SkillTag` in `src/types/game.ts` & `executeBattleTurn`)**：
  1. **剑意叠加与终结引爆 (`swordIntentGain` / `consumeSwordIntent`)**：基础剑招积攒剑意（每层 +6% 暴击），终结技如《万剑归宗·诛仙》消耗全部剑意，每层追加 `38% 攻击力` 的无视防御真伤！
  2. **破甲穿防 (`armorPiercePct`)**：雷法与高阶剑诀无视敌方 35%~50% 防御。
  3. **雷劫/玄冰麻痹控制 (`stunChance` / `enemyStunned`)**：概率令敌方本回合麻痹跳过出手。
  4. **厄难毒爆 (`poisonStacks` / `detonatePoison`)**：叠满 ≥5 层丹毒后立即引爆，结算巨额爆发毒伤。
  5. **残血狂暴 (`lowHpBerserk`) & 多段连斩 (`hitCount`)**：气血越低伤害越高，配合高额吸血实现绝地翻盘。
- **功法参悟升阶 (`upgradeSkill`)**：在【功法词条】面板可直接消耗灵石对任意已学功法进行【参悟升阶】，永久提升该功法的伤害倍率与等级。

---

## 三、 后续扩展开发规范（供接手 AI 遵循）

1. **新增女修角色**：在 `src/data/characters.ts` 或 `src/data/worldSandbox.ts` 的 `EXTRA_CHARACTERS` 中按 `CharacterData` 接口添加对象，必须完整填写 `chatOptions`（至少 3 项）、`dualCultivationScenes`（至少 4 幕）与 `proactiveVisitEvents`（至少 1~2 个主动事件）。
2. **新增功法与流派**：在 `src/data/itemsAndSkills.ts` 的 `SKILLS` 中添加，善用 `swordIntentGain`、`consumeSwordIntent`、`armorPiercePct`、`stunChance`、`detonatePoison`、`lowHpBerserk` 字段创造新流派联动。
3. **同步单文件预览与 Android 资源包**：修改 `src/` 下的 TypeScript 源码后，若需更新单文件 HTML 或 Android 离线包 (`android/app/src/main/assets/www/index.html`)，请同步更新并运行构建脚本，然后执行 `build_apk.bat` 或通过 GitHub Actions 编译 `.apk`。
