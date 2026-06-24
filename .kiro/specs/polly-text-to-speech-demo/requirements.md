# Requirements Document

## Introduction

本文档定义了 Amazon Polly Text-to-Speech Demo Web 应用的功能需求。该应用允许用户在网页上输入或粘贴文本，通过右键上下文菜单选择语言（中文、英文、广东话），调用后端 API 合成语音并播放。后端采用 Lambda Function URL + Lambda 架构，部署在 AWS 香港区域（ap-east-1）。

## Glossary

- **Frontend**: 基于 HTML/CSS/JavaScript 的静态网页应用，提供文本输入和语音播放交互界面
- **Backend**: 由 Lambda Function URL 和 Lambda 函数组成的无服务器后端服务
- **Lambda_Function**: 运行在 AWS Lambda 上的 Node.js 函数，负责调用 Amazon Polly 合成语音
- **Function_URL**: Lambda Function URL，前端通过此 URL 直连 Lambda 函数
- **Polly_Service**: Amazon Polly 文本转语音服务
- **Context_Menu**: 用户选中文本后右键弹出的自定义上下文菜单
- **Audio_Player**: 前端用于播放合成语音的音频播放组件
- **Selected_Text**: 用户在文本输入区域中通过鼠标选中的文本片段

## Requirements

### Requirement 1: Text Input

**User Story:** As a user, I want to input or paste text into a text area, so that I can have it read aloud in different languages.

#### Acceptance Criteria

1. THE Frontend SHALL display a text input area that accepts multi-line text input.
2. THE Frontend SHALL allow users to paste text from clipboard into the text input area.
3. THE Frontend SHALL allow users to select a portion of text within the text input area using mouse drag.

### Requirement 2: Custom Context Menu

**User Story:** As a user, I want to right-click on selected text and see language options, so that I can choose which language to use for speech synthesis.

#### Acceptance Criteria

1. WHEN the user right-clicks on Selected_Text, THE Frontend SHALL display a Context_Menu with three language options: 中文, English, 广东话.
2. WHEN the user right-clicks without any text selected, THE Frontend SHALL NOT display the Context_Menu and SHALL allow the browser default context menu to appear.
3. WHEN the Context_Menu is displayed, THE Frontend SHALL suppress the browser default context menu.
4. WHEN the user clicks outside the Context_Menu, THE Frontend SHALL hide the Context_Menu.

### Requirement 3: Speech Synthesis Request

**User Story:** As a user, I want to click a language option to hear the selected text spoken, so that I can listen to the text in my preferred language.

#### Acceptance Criteria

1. WHEN the user selects a language option from the Context_Menu, THE Frontend SHALL send the Selected_Text and the chosen language identifier to the Function_URL endpoint.
2. THE Frontend SHALL send requests to the Function_URL without including any AWS credentials in the request.
3. WHILE a speech synthesis request is in progress, THE Frontend SHALL display a loading indicator to inform the user.
4. IF the Function_URL returns an error response, THEN THE Frontend SHALL display an error message to the user.

### Requirement 4: Audio Playback

**User Story:** As a user, I want the synthesized speech to play automatically, so that I can hear the text without additional clicks.

#### Acceptance Criteria

1. WHEN the Frontend receives audio data from the Function_URL, THE Audio_Player SHALL play the audio immediately.
2. WHILE audio is playing, THE Frontend SHALL allow the user to continue interacting with the text input area.

### Requirement 5: Backend API Endpoint

**User Story:** As a developer, I want a REST API endpoint that accepts text and language parameters, so that the frontend can request speech synthesis without direct AWS access.

#### Acceptance Criteria

1. THE Function_URL SHALL expose a POST endpoint that accepts a JSON request body containing text content and language identifier.
2. WHEN the Function_URL receives a valid request, THE Lambda_Function SHALL process the request directly.
3. THE Lambda_Function SHALL enable CORS to allow requests from the Frontend origin.
4. IF the request body is missing text content or language identifier, THEN THE Lambda_Function SHALL return a 400 status code with an error message.

### Requirement 6: Lambda Speech Synthesis

**User Story:** As a developer, I want the Lambda function to call Polly and return audio, so that speech synthesis is handled server-side securely.

#### Acceptance Criteria

1. WHEN the Lambda_Function receives a request with language identifier "zh", THE Lambda_Function SHALL call the Polly_Service with a Mandarin Chinese voice.
2. WHEN the Lambda_Function receives a request with language identifier "en", THE Lambda_Function SHALL call the Polly_Service with an English voice.
3. WHEN the Lambda_Function receives a request with language identifier "yue", THE Lambda_Function SHALL call the Polly_Service with a Cantonese voice.
4. WHEN the Polly_Service returns synthesized audio, THE Lambda_Function SHALL return the audio stream in the HTTP response with appropriate content-type header.
5. IF the Polly_Service returns an error, THEN THE Lambda_Function SHALL return a 500 status code with an error description.
6. IF the request contains an unsupported language identifier, THEN THE Lambda_Function SHALL return a 400 status code with an error message.

### Requirement 7: Deployment Region

**User Story:** As a developer, I want all backend resources deployed in the Hong Kong region, so that latency is minimized for users in the region.

#### Acceptance Criteria

1. THE Function_URL SHALL be deployed in the AWS ap-east-1 region.
2. THE Lambda_Function SHALL be deployed in the AWS ap-east-1 region.
3. THE Lambda_Function SHALL call the Polly_Service in the ap-east-1 region.

### Requirement 8: Minimal UI Design

**User Story:** As a user, I want a clean and simple interface, so that I can focus on the text-to-speech functionality without distractions.

#### Acceptance Criteria

1. THE Frontend SHALL present a single-page layout with the text input area as the primary element.
2. THE Frontend SHALL include brief usage instructions visible to the user.
3. THE Context_Menu SHALL display language options in a compact, readable format.
