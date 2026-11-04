import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_WRAP = 'skipResponseWrap';

/**
 * 标记某个 Controller / Handler 不走统一 Response Envelope 包装。
 *
 * 用于基础设施类端点（例如健康检查、Swagger 文档），这些端点的响应格式
 * 由其所属协议/工具约定，不属于业务 API Contract。
 */
export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP, true);
