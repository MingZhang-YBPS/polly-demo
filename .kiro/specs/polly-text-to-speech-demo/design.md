# Design Document

## Introduction

本文档描述 Amazon Polly Text-to-Speech Demo 的技术设计方案。系统采用无服务器架构，前端为静态 HTML/CSS/JavaScript 页面，后端通过 Lambda Function URL 直连 Lambda 调用 Amazon Polly 服务完成语音合成。Lambda 部署在 AWS ap-east-1（香港）区域，但 Polly 调用指向 ap-southeast-1（新加坡）区域，因为 ap-east-1 不支持 neural 引擎。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Static)                      │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ TextArea │   │ Context Menu │   │   Audio Player   │    │
│  └──────────┘   └──────────────┘   └──────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ POST /synthesize
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Lambda Function URL                                         │
│  AuthType: NONE，直连 Lambda，无中间层                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Lambda Function (Node.js, ap-east-1)            │
│  - 语言映射                                                  │
│  - 输入验证                                                  │
│  - 调用 Polly（跨区域至 ap-southeast-1）                     │
│  - Provisioned Concurrency: 2                               │
└─────────────────────────┬───────────────────────────────────┘
                          │ SynthesizeSpeech API
                          │ (跨区域调用)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Amazon Polly (ap-southeast-1)                    │
│  注意：Lambda 在 ap-east-1，但 Polly 调用至 ap-southeast-1  │
│  原因：ap-east-1（香港）不支持 neural 引擎                   │
│  - 中文 (Zhiyu, neural)                                     │
│  - English (Joanna, neural)                                  │
│  - 广东话 (Hiujin, neural)                                  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Frontend（静态网页）

#### 文件结构

```
frontend/
├── index.html      # 主页面结构
├── style.css       # 样式文件
├── app.js          # 上下文菜单模块 + SynthesisOrchestrator + 应用初始化
├── apiClient.js    # API 通信模块
├── audioPlayer.js  # 音频播放模块
├── uiState.js      # UI 状态管理模块
└── package.json    # 前端开发配置
```

#### 核心模块

| 模块 | 职责 |
|------|------|
| ContextMenuModule | 管理自定义右键菜单的显示/隐藏逻辑 |
| SynthesisOrchestrator | 分句、并行预取、顺序播放、取消管理 |
| ApiClientModule | 封装与后端 API 的通信（支持 AbortController 取消） |
| AudioPlayerModule | 逐句播放音频（playSegment 模式） |
| UIStateModule | 管理加载状态、错误提示等 UI 状态 |

### 2. Backend（Lambda Function）

#### 文件结构

```
backend/
├── index.mjs           # Lambda 处理函数入口
├── pollyClient.mjs     # Polly 服务封装（ap-southeast-1）
├── voiceMapping.mjs    # 语言-语音映射配置
└── package.json        # 依赖声明
```

## Interfaces

### API Endpoint

**POST /synthesize**

通过 Lambda Function URL 直连访问。

#### Request

```json
{
  "text": "要合成的文本内容",
  "language": "zh"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 要合成语音的文本，非空 |
| language | string | 是 | 语言标识符：`zh`、`en`、`yue` |

#### Response - 成功 (200)

```
Content-Type: application/json
Body: { "audio": "<base64 encoded MP3>" }
```

#### Response - 客户端错误 (400)

```json
{
  "error": "Missing required field: text"
}
```

```json
{
  "error": "Unsupported language: fr. Supported languages: zh, en, yue"
}
```

#### Response - 服务端错误 (500)

```json
{
  "error": "Speech synthesis failed: <Polly error description>"
}
```

### 语言-语音映射

```javascript
// voiceMapping.mjs
export const VOICE_MAP = {
  zh: { voiceId: 'Zhiyu', languageCode: 'cmn-CN', engine: 'neural' },
  en: { voiceId: 'Joanna', languageCode: 'en-US', engine: 'neural' },
  yue: { voiceId: 'Hiujin', languageCode: 'yue-CN', engine: 'neural' }
};
```

## Data Flow

### 正常流程

1. 用户选中文本，右键选择语言
2. 前端"解锁"音频播放（静音 play 保持用户手势上下文）
3. SynthesisOrchestrator 按标点分句
4. 前端并行发送前 2 句的请求（预取窗口=2）
5. 第一句音频返回后立即开始播放，同时预取第 3 句
6. 每句播放完成后自动播放下一句，形成连续语音流
7. 如果用户中途发起新合成，AbortController 立即取消所有旧请求

### 错误流程

1. 请求缺少必填字段 → Lambda 返回 400 → 前端显示错误消息
2. 不支持的语言标识符 → Lambda 返回 400 → 前端显示错误消息
3. Polly 服务错误 → Lambda 返回 500 → 前端显示错误消息
4. 网络错误 → 前端 catch 异常 → 显示网络错误消息
5. 用户取消（AbortError）→ 静默处理，不显示错误

## 性能优化策略

### 分句并行预取

- 按标点（。！？；.!?;\n）分句
- 预取窗口大小：2（播放第 N 句时，第 N+1 和 N+2 句的请求已在进行中）
- 效果：用户只需等待第一句合成时间（~1.5s），后续句子无缝衔接

### 即时取消机制

- 每次新合成开始时调用 `AbortController.abort()` 取消所有旧的 fetch 请求
- 同时调用 `audioPlayer.stop()` 停止当前播放
- AbortError 被静默处理，不显示错误

### 音频播放解锁

- 在用户点击事件中同步播放静音音频，解锁浏览器自动播放策略
- 确保后续异步 play() 调用不被阻止

### Lambda Function URL

- 直连 Lambda，无中间层
- 节省 300-400ms 延迟

### Provisioned Concurrency

- 2 个预置并发实例，消除冷启动延迟

## Detailed Component Design

### Frontend - ContextMenuModule

```javascript
// 上下文菜单核心逻辑
class ContextMenuModule {
  constructor(menuElement, textAreaElement) {
    this.menuElement = menuElement;
    this.textAreaElement = textAreaElement;
    this.isVisible = false;
  }

  /**
   * 处理右键事件
   * 有选中文本时阻止默认菜单并显示自定义菜单；无选中文本时不干预
   * @param {MouseEvent} event - 右键点击事件
   */
  _handleContextMenu(event) {
    const selectedText = this._getSelectedText();
    if (!selectedText || selectedText.trim().length === 0) {
      this.hide();
      return;
    }
    event.preventDefault();
    this.show(event.clientX, event.clientY);
  }

  show(x, y) {
    this.menuElement.style.left = `${x}px`;
    this.menuElement.style.top = `${y}px`;
    this.menuElement.style.display = 'block';
    this.isVisible = true;
  }

  hide() {
    this.menuElement.style.display = 'none';
    this.isVisible = false;
  }

  _handleOutsideClick(event) {
    if (this.isVisible && !this.menuElement.contains(event.target)) {
      this.hide();
    }
  }
}
```

### Frontend - SynthesisOrchestrator

```javascript
// 核心编排器 - 分句 → 并行预取 → 顺序播放 → 取消管理
class SynthesisOrchestrator {
  constructor(apiClient, audioPlayer, uiState) {
    this.apiClient = apiClient;
    this.audioPlayer = audioPlayer;
    this.uiState = uiState;
    this.abortController = null;
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.audioPlayer.stop();
  }

  splitIntoSentences(text) {
    return text.split(/(?<=[。！？；.!?;\n])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  async synthesize(text, language) {
    this.cancel();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) return;

    this.uiState.hideError();
    this.uiState.showLoading();

    try {
      const PREFETCH = 2;
      const audioPromises = [];

      for (let i = 0; i < Math.min(PREFETCH, sentences.length); i++) {
        audioPromises[i] = this.apiClient.synthesize(sentences[i], language, signal);
      }

      for (let i = 0; i < sentences.length; i++) {
        if (signal.aborted) return;
        const audioBlob = await audioPromises[i];
        if (signal.aborted) return;
        if (i === 0) this.uiState.hideLoading();

        const nextIdx = i + PREFETCH;
        if (nextIdx < sentences.length) {
          audioPromises[nextIdx] = this.apiClient.synthesize(sentences[nextIdx], language, signal);
        }

        await this.audioPlayer.playSegment(audioBlob);
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      this.uiState.handleError(error);
    } finally {
      this.uiState.hideLoading();
    }
  }
}
```

### Frontend - ApiClientModule

```javascript
// API 通信模块（支持 AbortController 取消）
class ApiClientModule {
  constructor(apiEndpoint) {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * 发送可取消的语音合成请求
   * @param {string} text - 要合成的文本
   * @param {string} language - 语言标识符 (zh/en/yue)
   * @param {AbortSignal} [signal] - 用于取消请求的 AbortSignal
   * @returns {Promise<Blob>} 音频 Blob 数据 (audio/mpeg)
   */
  async synthesize(text, language, signal) {
    const response = await fetch(`${this.apiEndpoint}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `请求失败: ${response.status}`);
    }

    // 解析 JSON 响应并将 base64 字符串解码为二进制音频 Blob
    const data = await response.json();
    const binaryString = atob(data.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'audio/mpeg' });
  }
}
```

### Frontend - AudioPlayerModule

```javascript
// 音频播放模块 - 逐句播放模式
class AudioPlayerModule {
  constructor(audioElement) {
    this.audioElement = audioElement;
    this.currentBlobUrl = null;
    this.isPlaying = false;
  }

  /**
   * 播放单个音频片段，返回 Promise（播放完成时 resolve）
   * @param {Blob} audioBlob - 音频 Blob 数据
   * @returns {Promise<void>} 播放完成后 resolve
   */
  async playSegment(audioBlob) {
    this._cleanup();
    this.currentBlobUrl = URL.createObjectURL(audioBlob);
    this.audioElement.src = this.currentBlobUrl;
    this.isPlaying = true;

    await new Promise((resolve, reject) => {
      this.audioElement.onended = resolve;
      this.audioElement.onerror = reject;
      this.audioElement.oncanplaythrough = () => {
        this.audioElement.play().catch(reject);
      };
      if (this.audioElement.readyState >= 4) {
        this.audioElement.play().catch(reject);
      }
    });

    this.isPlaying = false;
  }

  stop() {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.audioElement.onended = null;
    this.audioElement.onerror = null;
    this.audioElement.oncanplaythrough = null;
    this.isPlaying = false;
    this._cleanup();
  }

  _cleanup() {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
}
```

### Backend - Lambda Handler

```javascript
// index.mjs - Lambda 入口
// 注意：Polly 客户端在 pollyClient.mjs 中创建，使用 ap-southeast-1 区域
import { SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { pollyClient } from './pollyClient.mjs';
import { VOICE_MAP, SUPPORTED_LANGUAGES } from './voiceMapping.mjs';

// 通用 CORS 响应头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { text, language } = body;

    // 输入验证
    if (!text || text.trim().length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing required field: text' })
      };
    }

    if (!language) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing required field: language' })
      };
    }

    const voiceConfig = VOICE_MAP[language];
    if (!voiceConfig) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `Unsupported language: ${language}. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`
        })
      };
    }

    // 调用 Polly
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceConfig.voiceId,
      LanguageCode: voiceConfig.languageCode,
      Engine: voiceConfig.engine
    });

    const pollyResponse = await pollyClient.send(command);

    // 将音频流转换为 base64 编码，以 JSON 格式返回
    const audioBytes = await pollyResponse.AudioStream.transformToByteArray();
    const audioBase64 = Buffer.from(audioBytes).toString('base64');

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ audio: audioBase64 })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: `Speech synthesis failed: ${error.message}`
      })
    };
  }
};
```

## Deployment

### Lambda Function URL 配置

- **AuthType**: NONE（无认证，直连模式）
- **用途**: 直连 Lambda，无中间层，低延迟
- **CORS**: 由 Lambda 函数自身处理

### Lambda 配置

- **运行时**: Node.js 20.x
- **区域**: ap-east-1
- **架构**: arm64
- **内存**: 512 MB
- **超时**: 30 秒
- **IAM 角色权限**: `polly:SynthesizeSpeech`
- **依赖**: `@aws-sdk/client-polly`
- **Polly 调用区域**: ap-southeast-1（新加坡），因为 ap-east-1 不支持 neural 引擎
- **Provisioned Concurrency**: 2（消除冷启动延迟）
- **AutoPublishAlias**: live

### 前端部署

前端为纯静态文件，可通过以下方式部署：
- `npm run dev` 本地开发服务器（开发阶段）
- S3 静态网站托管 + CloudFront（生产阶段）
- 任何静态文件服务器

## Error Handling

| 错误场景 | 层级 | HTTP 状态码 | 用户可见信息 |
|----------|------|-------------|-------------|
| 文本为空 | Lambda | 400 | "请输入要合成的文本" |
| 语言标识缺失 | Lambda | 400 | "请选择语言" |
| 不支持的语言 | Lambda | 400 | "不支持的语言选项" |
| Polly 服务错误 | Lambda | 500 | "语音合成服务暂时不可用，请稍后重试" |
| 网络连接错误 | Frontend | - | "网络连接失败，请检查网络后重试" |
| 请求超时 | Frontend | - | "请求超时，请稍后重试" |
| 用户取消（AbortError） | Frontend | - | 静默处理，不显示错误 |

## Security Considerations

1. **无客户端凭证**: 前端不包含任何 AWS 凭证，所有 AWS 服务调用通过 Lambda IAM 角色完成
2. **输入验证**: Lambda 对所有输入进行验证，防止注入攻击
3. **最小权限**: Lambda IAM 角色仅授予 `polly:SynthesizeSpeech` 权限
4. **CORS**: Lambda 函数配置 CORS 限制跨域访问
5. **文本长度限制**: 可在 Lambda 中添加文本长度检查，防止滥用（Polly 限制为 3000 字符）
6. **Function URL AuthType NONE**: 适用于公开演示场景，生产环境应考虑添加认证

## Correctness Properties

*属性（Property）是一个在系统所有有效执行中都应为真的特征或行为——本质上是关于系统应该做什么的形式化描述。属性作为人类可读规范与机器可验证正确性保证之间的桥梁。*

### Property 1: 上下文菜单显示条件

*For any* 非空的文本选择，当用户在选中文本上右键点击时，前端应显示包含恰好三个语言选项（中文、English、广东话）的自定义上下文菜单。

**Validates: Requirements 2.1**

### Property 2: 上下文菜单外部点击隐藏

*For any* 可见的上下文菜单和菜单边界之外的任意点击位置，该点击事件应导致上下文菜单隐藏。

**Validates: Requirements 2.4**

### Property 3: 请求体完整性

*For any* 非空文本和三种支持的语言标识符之一（zh/en/yue），前端发送的请求体应同时包含该文本内容和语言标识符，且不包含其他认证相关字段。

**Validates: Requirements 3.1, 3.2**

### Property 4: 错误响应用户反馈

*For any* API 返回的非 2xx HTTP 状态码，前端应向用户展示一条可见的错误消息。

**Validates: Requirements 3.4**

### Property 5: 请求验证 - 缺少字段

*For any* 请求体，若其缺少 `text` 字段或缺少 `language` 字段，API 应返回 HTTP 400 状态码及包含错误描述的 JSON 响应。

**Validates: Requirements 5.4**

### Property 6: 语言到语音的映射正确性

*For any* 支持的语言标识符（zh/en/yue），Lambda 函数应调用 Polly 服务时使用该语言对应的正确 VoiceId 和 LanguageCode；对于任何不在支持集合中的语言标识符，Lambda 应返回 400 错误。

**Validates: Requirements 6.1, 6.2, 6.3, 6.6**

### Property 7: 音频响应格式

*For any* Polly 服务成功返回的音频流，Lambda 函数的 HTTP 响应应为 JSON 格式 `{ "audio": "<base64>" }`，Content-Type 为 `application/json`，且 audio 字段为有效的 base64 编码音频数据。

**Validates: Requirements 6.4**

### Property 8: Polly 错误传播

*For any* Polly 服务返回的错误，Lambda 函数应返回 HTTP 500 状态码，且响应体应包含描述性错误信息。

**Validates: Requirements 6.5**
