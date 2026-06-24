// Lambda 处理函数入口
// 实现请求解析、输入验证、调用 Polly 服务并返回音频数据

import { SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { pollyClient } from './pollyClient.mjs';
import { VOICE_MAP, SUPPORTED_LANGUAGES } from './voiceMapping.mjs';

// 通用 CORS 响应头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/**
 * Lambda 处理函数
 * 接收文本和语言参数，调用 Polly 进行语音合成，返回 base64 编码的 MP3 音频
 */
export const handler = async (event) => {
  // 从 Lambda Function URL 事件格式中获取 HTTP 方法
  const httpMethod = event.requestContext?.http?.method;

  // 处理 CORS 预检请求
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  try {
    // 解析请求体
    const body = JSON.parse(event.body || '{}');
    const { text, language } = body;

    // 验证 text 字段：必填且非空
    if (!text || text.trim().length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing required field: text' })
      };
    }

    // 验证 language 字段：必填
    if (!language) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing required field: language' })
      };
    }

    // 验证语言标识符是否支持
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

    // 调用 Polly SynthesizeSpeech API，显式指定引擎类型以支持仅限 neural 的语音（如 Hiujin）
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceConfig.voiceId,
      LanguageCode: voiceConfig.languageCode,
      Engine: voiceConfig.engine
    });

    const pollyResponse = await pollyClient.send(command);

    // 将音频流转换为 base64 编码
    const audioBytes = await pollyResponse.AudioStream.transformToByteArray();
    const audioBase64 = Buffer.from(audioBytes).toString('base64');

    // 返回成功响应，以 JSON 格式包含 base64 编码的音频数据
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ audio: audioBase64 })
    };
  } catch (error) {
    // Polly 服务错误或其他未预期错误，返回 500
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: `Speech synthesis failed: ${error.message}`
      })
    };
  }
};
