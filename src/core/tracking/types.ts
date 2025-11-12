/**
 * 🔄 100% 复用自原系统
 * 来源: 上下文/上下文追踪/定义文件和模型追踪的数据结构.ts
 */

/**
 * 文件元数据条目
 */
export interface FileMetadataEntry {
  path: string; // 文件绝对路径
  state: 'read' | 'edited' | 'created'; // 文件状态
  source: 'tool' | 'mention' | 'user'; // 来源
  readDate?: number; // 读取时间戳
  editedDate?: number; // 编辑时间戳
  mtime?: number; // 文件修改时间（mtime）
  size?: number; // 文件大小（字节）
}

/**
 * 模型元数据条目
 */
export interface ModelMetadataEntry {
  modelId: string; // 模型 ID
  providerId: string; // 提供者 ID
  mode?: string; // 模式（如 thinking）
  firstUsedAt: number; // 首次使用时间
  lastUsedAt: number; // 最后使用时间
}

/**
 * 任务元数据
 */
export interface TaskMetadata {
  files: Record<string, FileMetadataEntry>; // 文件路径 -> 元数据
  models: ModelMetadataEntry[]; // 使用的模型列表
}