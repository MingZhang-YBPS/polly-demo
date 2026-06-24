/**
 * API 通信模块
 * 封装与后端语音合成 API 的通信逻辑
 */
class ApiClientModule {
  /**
   * 创建 API 客户端实例
   * @param {string} apiEndpoint - 后端 API 的基础 URL
   */
  constructor(apiEndpoint) {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * 发送可取消的语音合成请求
   * @param {string} text - 要合成的文本
   * @param {string} language - 语言标识符 (zh/en/yue)
   * @param {AbortSignal} [signal] - 用于取消请求的 AbortSignal
   * @returns {Promise<Blob>} 音频 Blob 数据 (audio/mpeg)
   * @throws {Error} 当服务端返回非 2xx 响应时抛出包含错误信息的异常
   */
  async synthesize(text, language, signal) {
    // 发送 POST 请求到 /synthesize 端点
    // 传入 signal 以支持请求取消
    const response = await fetch(`${this.apiEndpoint}/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, language }),
      signal // AbortSignal，用于取消进行中的请求
    });

    // 处理非 2xx 响应：解析错误信息并抛出异常
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
