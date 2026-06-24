// 语言-语音映射配置模块
// 定义支持的语言及其对应的 Polly 语音配置

/**
 * 语言标识符到 Polly 语音参数的映射
 * - zh: 中文（普通话）
 * - en: English
 * - yue: 广东话
 */
export const VOICE_MAP = {
  zh: { voiceId: 'Zhiyu', languageCode: 'cmn-CN', engine: 'neural' },
  en: { voiceId: 'Joanna', languageCode: 'en-US', engine: 'neural' },
  yue: { voiceId: 'Hiujin', languageCode: 'yue-CN', engine: 'neural' }
};

// 支持的语言标识符列表
export const SUPPORTED_LANGUAGES = Object.keys(VOICE_MAP);
