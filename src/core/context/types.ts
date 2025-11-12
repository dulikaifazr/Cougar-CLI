/**
 * 100% 复用自原系统的类型定义
 * 来源: 上下文/上下文管理核心/上下文管理器.ts
 */

import Anthropic from '@anthropic-ai/sdk';

export enum EditType {
  UNDEFINED = 0,
  NO_FILE_READ = 1,
  READ_FILE_TOOL = 2,
  ALTER_FILE_TOOL = 3,
  FILE_MENTION = 4,
}

// 数组允许我们覆盖当前支持的所有消息类型的更改
export type MessageContent = string[];
export type MessageMetadata = string[][];

// 单个上下文更新的类型
export type ContextUpdate = [number, string, MessageContent, MessageMetadata]; // [time stamp, update type, update, metadata]

// 序列化格式的类型，用于我们的嵌套映射
export type SerializedContextHistory = Array<
  [
    number, // 消息索引
    [
      number, // 编辑类型 (message type)
      Array<
        [
          number, // block index
          ContextUpdate[], // updates array (now with 4 elements including metadata)
        ]
      >,
    ],
  ]
>;

// API 消息类型（使用 Anthropic 的标准类型定义）
export type MessageParam = Anthropic.MessageParam;

/**
 * 文件上下文追踪相关类型
 * 参考官方源码：上下文/上下文追踪/定义文件和模型追踪的数据结构.ts
 */

// 文件元数据条目
export interface FileMetadataEntry {
  path: string;
  record_state: 'active' | 'stale';
  record_source: 'read_tool' | 'user_edited' | 'cline_edited' | 'file_mentioned';
  cline_read_date: number | null;
  cline_edit_date: number | null;
  user_edit_date?: number | null;
}

// 模型元数据条目
export interface ModelMetadataEntry {
  ts: number;
  model_id: string;
  model_provider_id: string;
  mode: string;
}

// 任务元数据
export interface TaskMetadata {
  files_in_context: FileMetadataEntry[];
  model_usage: ModelMetadataEntry[];
}
