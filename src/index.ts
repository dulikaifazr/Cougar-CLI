/**
 * Cline CLI - 主入口文件
 * 导出核心 API 供编程使用
 */

// 核心类
export { ApiHandler } from './api/handler';
export type { ApiHandlerOptions, ModelInfo, ApiProviderInfo } from './api/handler';

export { ContextManager } from './core/context/manager';
export { TaskExecutor } from './core/task/executor';
export type { TaskExecutorConfig } from './core/task/executor';

// 存储
export { SessionManager } from './core/storage/session';
export type { SessionMetadata } from './core/storage/session';
export { HistoryStorage } from './core/storage/history';

// 配置
export {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
} from './utils/config';
export type { CliConfig } from './types/config';

// 规则
export { getGlobalCougarRules } from './core/rules/global-rules';
export { getLocalCougarRules } from './core/rules/local-rules';
export { getGlobalWorkflows } from './core/rules/workflow';

// 工具
export { ToolExecutorCoordinator } from './core/tools/coordinator';
export { ToolValidator } from './core/tools/validator';
export type {
  TaskConfig,
  ToolResponse,
  IToolHandler,
  IFullyManagedTool,
} from './core/tools/types';

// 工具处理器
export { ReadFileHandler } from './core/tools/handlers/read-file';
export { WriteFileHandler } from './core/tools/handlers/write-file';
export { ExecuteCommandHandler } from './core/tools/handlers/execute-command';
export { ReplaceInFileHandler } from './core/tools/handlers/replace-in-file';
export { SearchFilesHandler } from './core/tools/handlers/search-files';
export { ListFilesHandler } from './core/tools/handlers/list-files';
export { ListCodeDefinitionsHandler } from './core/tools/handlers/list-code-definitions';
export { AskFollowupHandler } from './core/tools/handlers/ask-followup';
export { AttemptCompletionHandler } from './core/tools/handlers/attempt-completion';
export { WebScrapeHandler } from './core/tools/handlers/web-scrape';
export { NewTaskHandler } from './core/tools/handlers/new-task';
export { PlanModeRespondHandler } from './core/tools/handlers/plan-mode-respond';
export { CompressConversationHandler } from './core/tools/handlers/compress-conversation';
export { SummarizeTaskHandler } from './core/tools/handlers/summarize-task';

// 追踪
export {
  trackModelUsage,
  getUsedModels,
} from './core/tracking/model-tracker';
export {
  trackFileRead,
  trackFileEdit,
  getTrackedFiles,
  getStaleFileWarning,
} from './core/tracking/file-tracker';

// 提示词
export { getSystemPrompt } from './prompts/system';
export type { SystemPromptContext } from './prompts/system';
export {
  formatResponse,
  newTaskToolResponse,
  condenseToolResponse,
  summarizeTask,
  loadMcpDocumentation,
} from './prompts/runtime';

// 会话工具
export {
  getAllSessions,
  getSessionInfo,
  deleteSession,
  clearSessionHistory,
  exportSession,
  formatTimestamp,
  formatBytes,
  getSessionSize,
} from './core/storage/session-utils';