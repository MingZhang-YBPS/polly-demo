# Implementation Plan: Amazon Polly Text-to-Speech Demo

## Overview

本实现计划将 Amazon Polly TTS Demo 拆分为前端静态网页和后端 Lambda 函数两大部分，按增量方式推进：先搭建项目结构和核心接口，再分别实现后端 API 和前端交互逻辑，最后完成集成联调。

## Tasks

- [x] 1. 搭建项目结构和核心配置
  - [x] 1.1 创建后端项目结构和依赖配置
    - 创建 `backend/` 目录，包含 `index.mjs`、`pollyClient.mjs`、`voiceMapping.mjs`、`package.json`
    - `package.json` 声明 `@aws-sdk/client-polly` 依赖，设置 `"type": "module"`
    - _Requirements: 7.1, 7.2_

  - [x] 1.2 创建前端项目结构
    - 创建 `frontend/` 目录，包含 `index.html`、`style.css`、`app.js`
    - `index.html` 包含基本 HTML5 骨架、引用 CSS 和 JS 文件
    - _Requirements: 8.1_

- [x] 2. 实现后端语言映射和输入验证
  - [x] 2.1 实现语言-语音映射模块 (voiceMapping.mjs)
    - 定义 `VOICE_MAP` 对象，包含 zh/en/yue 三种语言的 voiceId 和 languageCode
    - 导出 `VOICE_MAP` 和支持的语言列表
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 2.2 编写语言映射的属性测试
    - **Property 6: 语言到语音的映射正确性**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.6**

  - [x] 2.3 实现 Lambda 处理函数 (index.mjs)
    - 实现请求体解析和输入验证（text 非空、language 必填）
    - 实现语言标识符验证（不支持时返回 400）
    - 调用 Polly SynthesizeSpeech API，返回 base64 编码的 MP3 音频
    - 添加 CORS 响应头（Access-Control-Allow-Origin: *）
    - 实现错误处理：400 用于客户端错误，500 用于 Polly 服务错误
    - _Requirements: 5.1, 5.3, 5.4, 6.4, 6.5, 6.6_

  - [ ]* 2.4 编写请求验证的属性测试
    - **Property 5: 请求验证 - 缺少字段**
    - **Validates: Requirements 5.4**

  - [ ]* 2.5 编写音频响应格式的属性测试
    - **Property 7: 音频响应格式**
    - **Validates: Requirements 6.4**

  - [ ]* 2.6 编写 Polly 错误传播的属性测试
    - **Property 8: Polly 错误传播**
    - **Validates: Requirements 6.5**

- [x] 3. Checkpoint - 确保后端所有测试通过
  - 确保后端所有测试通过，如有问题请询问用户。

- [x] 4. 实现前端文本输入和页面布局
  - [x] 4.1 实现主页面结构 (index.html)
    - 创建包含文本输入区域（textarea）、使用说明、自定义上下文菜单容器、音频播放器的页面结构
    - 上下文菜单包含三个语言选项按钮：中文、English、广东话
    - 添加加载指示器和错误消息容器
    - _Requirements: 1.1, 8.1, 8.2, 8.3_

  - [x] 4.2 实现页面样式 (style.css)
    - 实现简洁的单页面布局，textarea 作为主要元素居中显示
    - 实现自定义上下文菜单样式（紧凑可读）
    - 实现加载指示器和错误消息样式
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 5. 实现前端交互逻辑
  - [x] 5.1 实现上下文菜单模块 (ContextMenuModule)
    - 监听 textarea 的 `contextmenu` 事件
    - 有选中文本时：阻止默认菜单，在鼠标位置显示自定义菜单
    - 无选中文本时：不显示自定义菜单，允许浏览器默认行为
    - 监听外部点击事件，点击菜单外区域时隐藏菜单
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.2 编写上下文菜单显示条件的属性测试
    - **Property 1: 上下文菜单显示条件**
    - **Validates: Requirements 2.1**

  - [ ]* 5.3 编写上下文菜单外部点击隐藏的属性测试
    - **Property 2: 上下文菜单外部点击隐藏**
    - **Validates: Requirements 2.4**

  - [x] 5.4 实现 API 通信模块 (ApiClientModule)
    - 封装 `fetch` 调用，发送 POST 请求到 `/synthesize` 端点
    - 请求体包含 `text` 和 `language` 字段，不包含 AWS 凭证
    - 处理非 2xx 响应，解析错误信息并抛出异常
    - 成功时返回音频 Blob 数据
    - _Requirements: 3.1, 3.2, 3.4_

  - [ ]* 5.5 编写请求体完整性的属性测试
    - **Property 3: 请求体完整性**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 5.6 实现音频播放模块 (AudioPlayerModule)
    - 接收音频 Blob 数据，创建 Blob URL
    - 使用 Audio 元素自动播放
    - 播放期间不阻塞用户对文本区域的操作
    - _Requirements: 4.1, 4.2_

  - [x] 5.7 实现 UI 状态管理 (UIStateModule)
    - 请求中显示加载指示器
    - 请求完成后隐藏加载指示器
    - 错误时显示用户友好的中文错误消息
    - 网络错误显示 "网络连接失败，请检查网络后重试"
    - _Requirements: 3.3, 3.4_

  - [ ]* 5.8 编写错误响应用户反馈的属性测试
    - **Property 4: 错误响应用户反馈**
    - **Validates: Requirements 3.4**

- [x] 6. 集成和联调
  - [x] 6.1 将所有前端模块连接整合 (app.js 主入口)
    - 初始化所有模块，配置 API 端点地址
    - 连接上下文菜单语言选项点击事件到合成流程
    - 完整流程：选中文本 → 右键菜单 → 选择语言 → 显示加载 → 调用API → 播放音频/显示错误
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 4.1_

  - [ ]* 6.2 编写前端集成测试
    - 测试完整的用户操作流程
    - 测试错误场景处理
    - _Requirements: 2.1, 3.4, 4.1_

- [x] 7. 最终 Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## Notes

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了对应的需求编号，确保可追溯性
- Checkpoint 任务确保增量验证，及时发现问题
- 属性测试验证设计文档中定义的正确性属性
- 单元测试验证具体的边界情况和错误场景
- 前端为纯静态文件，开发阶段可直接用浏览器打开 `index.html` 测试
- 后端部署到 AWS ap-east-1 区域，需要对应的 AWS 账户权限

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "4.2"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["5.5", "5.6", "5.7"] },
    { "id": 6, "tasks": ["5.8", "6.1"] },
    { "id": 7, "tasks": ["6.2"] }
  ]
}
```
