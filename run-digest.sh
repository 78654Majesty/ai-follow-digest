#!/bin/bash

# AI Follow Digest - 整合 AI Builders 动态 + HN 博客精选

# DeepSeek API 配置
export OPENAI_API_KEY="你的API密钥"  # 请替换为你的实际密钥
export OPENAI_API_BASE="https://api.deepseek.com/v1"

# 输出目录
OUTPUT_DIR="/你的输出目录路径"

# 语言设置：zh(中文), en(英文)
LANGUAGE="zh"

# 执行 digest 脚本
node /你的项目路径/ai-follow-digest/run-digest.js \
  --output "$OUTPUT_DIR" \
  --language "$LANGUAGE"