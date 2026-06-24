// Polly 服务封装模块
// 注意：Lambda 部署在 ap-east-1（香港），但 Polly 调用指向 ap-southeast-1（新加坡）
// 因为 ap-east-1 不支持 neural 引擎

import { PollyClient } from '@aws-sdk/client-polly';

// 创建 Polly 客户端实例
// 使用 ap-southeast-1（新加坡）因为该区域支持 neural 引擎
const pollyClient = new PollyClient({ region: 'ap-southeast-1' });

export { pollyClient };
