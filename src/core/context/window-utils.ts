/**
 * 🔄 100% 复用自原系统
 * 来源: 上下文/上下文管理核心/窗口工具函数.ts
 * 
 * 核心作用： 计算不同 AI 模型的上下文窗口大小和安全阈值
 * 为不同模型设置安全缓冲区：
 * - DeepSeek 64K: 留 27K 缓冲
 * - 通用 128K: 留 30K 缓冲
 * - Claude 200K: 留 40K 缓冲
 */
import { ApiHandler } from '../../api/handler';

/**
 * 获取给定 API 处理程序的上下文窗口信息
 *
 * @param api 用于获取上下文窗口信息的 API 处理器
 * @returns 包含原始上下文窗口大小和有效最大允许大小的对象
 */
export function getContextWindowInfo(api: ApiHandler): {
  contextWindow: number;
  maxAllowedSize: number;
} {
  // 获取模型信息
  const modelInfo = api.getModel();
  
  // 获取模型的上下文窗口大小，默认 128K
  let contextWindow = modelInfo.model.info.contextWindow || 128_000;

  // 处理特殊情况，如 DeepSeek
  const modelId = modelInfo.model.id.toLowerCase();
  if (modelId.includes('deepseek')) {
    contextWindow = 128_000;
  }

  let maxAllowedSize: number;
  switch (contextWindow) {
    case 64_000: // DeepSeek 模型
      maxAllowedSize = contextWindow - 27_000;
      break;
    case 128_000: // 大多数模型
      maxAllowedSize = contextWindow - 30_000;
      break;
    case 200_000: // Claude 模型
      maxAllowedSize = contextWindow - 40_000;
      break;
    default:
      // 对于其他模型，使用 80% 或减去 40K，取较大值
      maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8);
  }

  return { contextWindow, maxAllowedSize };
}