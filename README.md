# Amazon Polly 文字转语音演示

基于 AWS 无服务器架构的文字转语音演示应用，支持中文、英文和广东话三种语言的语音合成。

## 项目简介

本项目使用 Amazon Polly 服务将文本转换为自然语音。用户在网页中选中文本后，通过右键菜单选择语言即可听到对应语音朗读。

**技术架构：**
- 前端：纯静态 HTML/CSS/JavaScript 页面
- 后端：Lambda（Node.js 20.x，arm64 架构）
- 接入方式：Lambda Function URL（直连 Lambda，低延迟）
- 性能优化：分句并行预取 + 流式顺序播放
- 取消机制：AbortController 支持随时中断
- 语音服务：Amazon Polly（neural 引擎，区域 ap-southeast-1 新加坡）
- 部署区域：ap-east-1（香港）
- Polly 区域：ap-southeast-1（新加坡），因为 ap-east-1 不支持 neural 引擎

**支持语言：**
| 语言 | 标识符 | Polly 语音 | 引擎 |
|------|--------|-----------|------|
| 中文（普通话） | zh | Zhiyu | neural |
| English | en | Joanna | neural |
| 广东话 | yue | Hiujin | neural |

## 性能特性

- **分句流式播放**：长文本按标点（。！？；.!?;）自动分句，第一句合成完即开始播放，后续句子并行预取（滑动窗口 = 2）
- **即时取消**：播放过程中重新选文本朗读，之前的请求立即取消（AbortController），不会产生多余的网络开销
- **实测性能**：900 字文章从点击到听到声音约 1.5 秒
- **Provisioned Concurrency**：Lambda 预置并发 = 2，消除冷启动延迟

## 前置条件

部署前请确保已安装以下工具：

1. **AWS CLI** - AWS 命令行工具
   ```bash
   # 安装后需配置凭证
   aws configure
   ```

2. **AWS SAM CLI** - 无服务器应用模型命令行工具
   ```bash
   # macOS
   brew install aws-sam-cli

   # 其他系统请参考：https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
   ```

3. **Node.js** (>= 18.x)
   ```bash
   node --version
   ```

4. **AWS 账户权限** - 需要以下权限：
   - CloudFormation（创建/更新堆栈）
   - Lambda（创建/更新函数）
   - IAM（创建角色）
   - S3（上传部署包）
   - Polly（语音合成）

## 部署步骤

### 方法一：使用部署脚本（推荐）

```bash
# 添加执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

### 方法二：手动部署

```bash
# 1. 安装后端依赖
cd backend && npm install && cd ..

# 2. SAM 构建
sam build

# 3. SAM 部署（首次部署会提示确认变更集）
sam deploy
```

部署完成后，终端会输出 Function URL。

## 前端配置

部署完成后，需要将 Function URL 配置到前端代码中。

配置步骤：

1. 从部署输出中复制 Function URL

2. 打开 `frontend/app.js`，找到 `API_ENDPOINT` 变量并替换：
   ```javascript
   const API_ENDPOINT = 'https://xxx.lambda-url.ap-east-1.on.aws';
   ```

   > **注意**：Function URL 不需要 `/prod` 路径前缀，直接 POST `/synthesize` 即可。

3. 启动前端开发服务器：
   ```bash
   cd frontend
   npm run dev
   # 访问 http://localhost:8080
   ```

## 本地测试方法

### 使用 SAM Local 测试后端

```bash
# 启动本地 API 模拟
sam local start-api

# 本地 API 默认运行在 http://127.0.0.1:3000
```

测试请求示例：

```bash
# 测试中文语音合成（返回 JSON，包含 base64 编码的音频数据）
curl -X POST http://127.0.0.1:3000/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "你好世界", "language": "zh"}'
# 响应格式: {"audio": "<base64 编码的 MP3 数据>"}

# 测试英文语音合成
curl -X POST http://127.0.0.1:3000/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World", "language": "en"}'
# 响应格式: {"audio": "<base64 编码的 MP3 数据>"}

# 测试广东话语音合成
curl -X POST http://127.0.0.1:3000/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "你好", "language": "yue"}'
# 响应格式: {"audio": "<base64 编码的 MP3 数据>"}
```

### 前端本地开发

本地测试时，将 `frontend/app.js` 中的 `API_ENDPOINT` 设为本地地址：

```javascript
const API_ENDPOINT = 'http://127.0.0.1:3000';
```

然后启动前端开发服务器（注意：不能直接打开 index.html，file:// 协议会因浏览器安全策略导致请求失败）：

```bash
cd frontend
npm run dev
# 访问 http://localhost:8080
```

## 项目结构

```
polly-demo/
├── template.yaml       # SAM 模板（基础设施即代码）
├── samconfig.toml      # SAM 部署配置
├── deploy.sh           # 一键部署脚本
├── README.md           # 本文件
├── backend/
│   ├── index.mjs           # Lambda 处理函数入口
│   ├── pollyClient.mjs     # Polly 客户端封装（指向 ap-southeast-1）
│   ├── voiceMapping.mjs    # 语言-语音映射配置
│   └── package.json        # 后端依赖
└── frontend/
    ├── index.html      # 主页面
    ├── style.css       # 样式
    ├── app.js          # 主逻辑（SynthesisOrchestrator 编排器：分句、并行预取、顺序播放、取消管理）
    ├── apiClient.js    # API 通信模块（处理 JSON/base64 响应）
    ├── audioPlayer.js  # 音频播放模块（逐段播放）
    ├── uiState.js      # UI 状态管理
    └── package.json    # 前端开发服务器配置
```

## 清理资源

如需删除已部署的 AWS 资源：

```bash
sam delete --stack-name polly-tts-demo --region ap-east-1
```
