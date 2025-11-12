/**
 * 🔄 90% 复用自原系统
 * 来源: 上下文/上下文追踪/模型上下文追踪.ts
 * 
 * 核心作用：记录任务中使用的 AI 模型
 * 主要改动：移除 Controller 依赖，适配 CLI 存储
 */
import { ModelMetadataEntry, TaskMetadata } from './types';
import { getTaskMetadata, saveTaskMetadata } from './metadata';

/**
 * 🔄 100% 复用：记录模型使用
 * 
 * @param sessionId 会话 ID
 * @param modelId 模型 ID
 * @param providerId 提供者 ID
 * @param mode 模式（可选）
 */
export async function trackModelUsage(
  sessionId: string,
  modelId: string,
  providerId: string,
  mode?: string
): Promise<void> {
  const metadata = await getTaskMetadata(sessionId);
  const now = Date.now();

  // 检查是否已经记录过此模型
  const existingEntry = metadata.models.find(
    (entry) =>
      entry.modelId === modelId &&
      entry.providerId === providerId &&
      entry.mode === mode
  );

  if (existingEntry) {
    // 如果已存在，更新最后使用时间
    existingEntry.lastUsedAt = now;
  } else {
    // 如果未记录，添加新条目
    const newEntry: ModelMetadataEntry = {
      modelId,
      providerId,
      mode,
      firstUsedAt: now,
      lastUsedAt: now,
    };
    metadata.models.push(newEntry);
  }
  
  await saveTaskMetadata(sessionId, metadata);
}

/**
 * 🆕 获取已使用的模型列表
 */
export async function getUsedModels(sessionId: string): Promise<ModelMetadataEntry[]> {
  const metadata = await getTaskMetadata(sessionId);
  return metadata.models;
}

/**
 * 🆕 清除模型使用记录
 */
export async function clearModelTracking(sessionId: string): Promise<void> {
  const metadata = await getTaskMetadata(sessionId);
  metadata.models = [];
  await saveTaskMetadata(sessionId, metadata);
}