#!/bin/bash
# 部署脚本 - Amazon Polly 文字转语音演示
# 使用 AWS SAM CLI 构建并部署后端服务

set -e

echo "========================================="
echo "  Amazon Polly TTS Demo 部署脚本"
echo "========================================="
echo ""

# 步骤 1：安装后端依赖
echo "📦 步骤 1：安装后端依赖..."
cd backend && npm install
cd ..
echo "✅ 依赖安装完成"
echo ""

# 步骤 2：SAM 构建
echo "🔨 步骤 2：SAM 构建..."
sam build
echo "✅ 构建完成"
echo ""

# 步骤 3：SAM 部署
echo "🚀 步骤 3：SAM 部署..."
sam deploy
echo "✅ 部署完成"
echo ""

# 步骤 4：获取 Function URL
echo "========================================="
echo "  部署结果"
echo "========================================="

FUNCTION_URL=$(aws cloudformation describe-stacks \
  --stack-name polly-tts-demo \
  --region ap-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`FunctionUrl`].OutputValue' \
  --output text)

echo ""
echo "🚀 Function URL: ${FUNCTION_URL}"
echo ""
echo "========================================="
echo "  下一步操作"
echo "========================================="
echo ""
echo "请将 frontend/app.js 中的 API_ENDPOINT 改为 Function URL："
echo "    const API_ENDPOINT = '${FUNCTION_URL}';"
echo ""
echo "    注意：Function URL 末尾可能有 /，不要重复加路径中的 /"
echo ""
echo "然后在浏览器中打开 frontend/index.html 即可使用。"
echo "========================================="
