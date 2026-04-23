# AI Follow Digest

整合 **AI Builders 动态** + **HN 博客精选** 的自动化日报生成器。

---

## 数据源

| 来源 | 项目 | 内容 |
|------|------|------|
| **AI Builders** | [follow-builders](https://github.com/zarazhangrui/follow-builders) | 25 位 AI 建造者（Karpathy, Swyx, Sam Altman）、6 个播客、官方博客 |
| **HN 博客精选** | [ai-daily-digest](https://github.com/Cunninger/ai-daily-digest) | Karpathy 推荐的 90 个顶级技术博客，AI 评分筛选 |

---

## 输出结构

```markdown
# AI Follow Digest — 2026年4月23日

## 目录
1. AI Builders 动态
   - X / Twitter
   - 官方博客
   - 播客
2. HN 博客精选
   - 今日必读
   - 分类文章

---

## 一、AI Builders 动态

### 1.1 X / Twitter

1. **Andrej Karpathy**

   > [摘要] 关于 Software 3.0 的深度讨论...

   [原文链接](https://x.com/karpathy/status/xxx)

---

## 二、HN 博客精选

### 2.1 今日必读

1. 🥇 **为什么 Agent 总是失败** [翻译]

   *原文: Why Agents Keep Failing*

   > [摘要] 大多数 Agent 失败不是因为智能问题...

   [原文链接](https://xxx) — Latent Space
```

---

## 使用方式

### 1. 配置

编辑 `run-digest.sh`：

```bash
export OPENAI_API_KEY="你的API密钥"
OUTPUT_DIR="/你的输出目录路径"
```

### 2. 运行

```bash
sh run-digest.sh
```

### 3. 输出

```
/你的输出目录路径/ai-follow-digest-YYYY-MM-DD.md
```

---

## 参数

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | API 密钥 | **必填** |
| `OPENAI_API_BASE` | API 地址 | `https://api.deepseek.com/v1` |
| `OPENAI_MODEL` | 模型 | `deepseek-chat` |

---

## 定时运行

```bash
crontab -e

# 每天 8:00
0 8 * * * /你的项目路径/ai-follow-digest/run-digest.sh
```

---

## 依赖

- Node.js 18+
- DeepSeek/OpenAI API Key

---

## 致谢

- [follow-builders](https://github.com/zarazhangrui/follow-builders)
- [ai-daily-digest](https://github.com/Cunninger/ai-daily-digest)

---

MIT