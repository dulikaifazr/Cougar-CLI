/**
 * 任务执行器
 * 适配自 task/index.ts
 * 
 * 核心作用：
 * - 协调所有模块的工作
 * - 实现完整的 AI 对话循环
 * - 管理工具执行流程
 * - 处理消息流转
 * 
 * CLI 适配：
 * - 移除 VSCode 特定功能
 * - 简化为 console 交互
 * - 保留核心逻辑
 */

import Anthropic from '@anthropic-ai/sdk';
import { ApiHandler } from '../../api/handler';
import { parseAssistantMessageV2, ToolUse } from '../assistant-message';
import { ContextManager } from '../context/manager';
import { TaskState, ClineAskResponse } from './state';
import { ToolExecutorCoordinator } from '../tools/coordinator';
import { ToolValidator } from '../tools/validator';
import { ReadFileHandler } from '../tools/handlers/read-file';
import { WriteFileHandler } from '../tools/handlers/write-file';
import { ExecuteCommandHandler } from '../tools/handlers/execute-command';
import { AskFollowupHandler } from '../tools/handlers/ask-followup';
import { AttemptCompletionHandler } from '../tools/handlers/attempt-completion';
import { ReplaceInFileHandler } from '../tools/handlers/replace-in-file';
import { SearchFilesHandler } from '../tools/handlers/search-files';
import { ListFilesHandler } from '../tools/handlers/list-files';
import { ListCodeDefinitionsHandler } from '../tools/handlers/list-code-definitions';
import { WebScrapeHandler } from '../tools/handlers/web-scrape';
import { NewTaskHandler } from '../tools/handlers/new-task';
import { PlanModeRespondHandler } from '../tools/handlers/plan-mode-respond';
import { CompressConversationHandler } from '../tools/handlers/compress-conversation';
import { SummarizeTaskHandler } from '../tools/handlers/summarize-task';
import { ToolResultHandler } from '../tools/utils/tool-result-handler';
import { TaskConfig, ToolResponse } from '../tools/types';
import { getSystemPrompt } from '../../prompts/system';
import type { SystemPromptContext } from '../../prompts/system';
import { FeaturesManager, createFeaturesManager } from './features-manager';
import { AdvancedFeaturesConfig } from '../../config/advanced-features';
import { TaskStateExtensions } from './state-extensions';
import { FileContextTracker } from '../context/file-tracker';

/**
 * 任务执行器配置
 */
export interface TaskExecutorConfig {
  taskId: string;
  cwd: string;
  apiHandler: ApiHandler;
  contextManager: ContextManager;
  onSay?: (type: string, text?: string, images?: string[], files?: string[], partial?: boolean) => Promise<number | undefined>;
  onAsk?: (type: string, text?: string, partial?: boolean) => Promise<{
    response: ClineAskResponse;
    text?: string;
    images?: string[];
    files?: string[];
  }>;
  // 高级功能配置（可选）
  advancedFeatures?: Partial<AdvancedFeaturesConfig>;
}

/**
 * 任务执行器类
 */
export class TaskExecutor {
  private taskId: string;
  private cwd: string;
  private api: ApiHandler;
  private contextManager: ContextManager;
  private taskState: TaskState;
  private coordinator: ToolExecutorCoordinator;
  private validator: ToolValidator;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private fileTracker: FileContextTracker;
  private onSay?: (type: string, text?: string, images?: string[], files?: string[], partial?: boolean) => Promise<number | undefined>;
  private onAsk?: (type: string, text?: string, partial?: boolean) => Promise<{
    response: ClineAskResponse;
    text?: string;
    images?: string[];
    files?: string[];
  }>;
  private featuresManager: FeaturesManager;

  constructor(config: TaskExecutorConfig) {
    this.taskId = config.taskId;
    this.cwd = config.cwd;
    this.api = config.apiHandler;
    this.contextManager = config.contextManager;
    this.taskState = new TaskState();
    this.onSay = config.onSay;
    this.onAsk = config.onAsk;

    // 初始化工具系统
    this.validator = new ToolValidator();
    this.coordinator = new ToolExecutorCoordinator();
    
    // 初始化文件追踪器
    this.fileTracker = new FileContextTracker(this.taskId, this.cwd);
    
    // 注册核心工具
    this.registerTools();

    // 初始化高级功能管理器
    this.featuresManager = createFeaturesManager({
      taskId: this.taskId,
      cwd: this.cwd,
      taskState: this.taskState,
      features: config.advancedFeatures,
    });
  }

  /**
   * 注册所有工具处理器
   */
  private registerTools(): void {
    // 文件操作工具
    this.coordinator.register(new ReadFileHandler(this.validator));
    this.coordinator.register(new WriteFileHandler(this.validator));
    this.coordinator.register(new ReplaceInFileHandler(this.validator));
    
    // 搜索和列表工具
    this.coordinator.register(new SearchFilesHandler(this.validator));
    this.coordinator.register(new ListFilesHandler(this.validator));
    this.coordinator.register(new ListCodeDefinitionsHandler(this.validator));
    
    // 命令执行
    this.coordinator.register(new ExecuteCommandHandler(this.validator));
    
    // 交互工具
    this.coordinator.register(new AskFollowupHandler(this.validator));
    this.coordinator.register(new AttemptCompletionHandler(this.validator));
    
    // 高级功能
    this.coordinator.register(new WebScrapeHandler(this.validator));
    this.coordinator.register(new NewTaskHandler(this.validator));
    this.coordinator.register(new PlanModeRespondHandler(this.validator));
    this.coordinator.register(new CompressConversationHandler(this.validator));
    this.coordinator.register(new SummarizeTaskHandler(this.validator));
  }

  /**
   * 创建 TaskConfig
   */
  private createTaskConfig(): TaskConfig {
    return {
      taskId: this.taskId,
      ulid: this.taskId,
      cwd: this.cwd,
      mode: 'act',
      taskState: this.taskState,
      messageState: null as any,
      api: this.api,
      services: {},
      callbacks: {
        say: async (type: any, text?: string, images?: string[], files?: string[], partial?: boolean) => {
          if (this.onSay) {
            return await this.onSay(type, text, images, files, partial);
          }
          return Date.now();
        },
        ask: async (type: any, text?: string, partial?: boolean) => {
          if (this.onAsk) {
            return await this.onAsk(type, text, partial);
          }
          return {
            response: ClineAskResponse.yesButtonClicked,
            text: '',
            images: [],
            files: [],
          };
        },
        shouldAutoApproveTool: () => false,
      },
      taskExecutor: this,
    };
  }

  /**
   * 构建系统提示词（增强版 - 包含 Focus Chain 和文件列表）
   */
  private async buildSystemPrompt(includeFileDetails: boolean = false): Promise<string> {
    const modelInfo = this.api.getModel();
    
    const context: SystemPromptContext = {
      cwd: this.cwd,
      modelId: modelInfo.model.id,
      apiConfiguration: {
        apiKey: this.api.getConfiguration().apiKey,
        baseUrl: this.api.getConfiguration().baseUrl,
        modelId: modelInfo.model.id,
      },
      mode: 'act',
    };

    let systemPrompt = await getSystemPrompt(context);

    // 添加 Focus Chain 指令
    const focusChainInstructions = this.featuresManager.generateFocusChainInstructions('act');
    if (focusChainInstructions) {
      systemPrompt += focusChainInstructions;
    }

    // 添加环境详情（包含文件列表）
    const environmentDetails = await this.getEnvironmentDetails(includeFileDetails);
    if (environmentDetails) {
      systemPrompt += environmentDetails;
    }

    return systemPrompt;
  }

  /**
   * 获取环境详情（参考官方实现）
   * 包含：工作目录、当前时间、文件列表（首次）等
   */
  private async getEnvironmentDetails(includeFileDetails: boolean = false): Promise<string> {
    let details = '';

    // 当前时间
    const now = new Date();
    const formatter = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true,
    });
    const timeZone = formatter.resolvedOptions().timeZone;
    const timeZoneOffset = -now.getTimezoneOffset() / 60;
    const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? '+' : ''}${timeZoneOffset}:00`;
    details += `\n\n# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`;

    // 文件列表（只在首次对话时包含）
    if (includeFileDetails) {
      try {
        console.log('\n📁 正在加载项目文件结构...');
        const fileList = await this.getProjectFileList();
        if (fileList) {
          details += `\n\n# Project Files\n${fileList}`;
          console.log('   ✓ 文件结构已加载');
        }
      } catch (error: any) {
        console.warn(`   ⚠️  无法加载文件列表: ${error.message}`);
        details += '\n\n# Project Files\n(Unable to list files automatically. Use list_files tool if needed.)';
      }
    }

    // 已读取的文件（始终显示）
    const readFiles = this.fileTracker.getReadFiles();
    if (readFiles.length > 0) {
      details += '\n\n# Files Already Read in This Conversation';
      details += '\nYou have already read the following files. Their contents are in your context.';
      details += '\nDo NOT read them again unless they have been modified or you need to verify recent changes.';
      details += '\n\nRead files:';
      readFiles.forEach(file => {
        details += `\n- ${file}`;
      });
    }

    // 最近修改的文件
    const recentlyModifiedFiles = this.fileTracker.getAndClearRecentlyModifiedFiles();
    if (recentlyModifiedFiles.length > 0) {
      details += '\n\n# Recently Modified Files';
      details += '\nThese files have been modified since you last accessed them:';
      recentlyModifiedFiles.forEach(file => {
        details += `\n- ${file} (file was just edited, you may need to re-read it before editing)`;
      });
    }

    return details ? `\n\n<environment_details>${details}\n</environment_details>` : '';
  }

  /**
   * 获取项目文件列表（参考官方实现）
   */
  private async getProjectFileList(): Promise<string> {
    const listFilesHandler = new ListFilesHandler(this.validator);
    
    try {
      // 调用 list_files 工具获取文件列表
      const result = await listFilesHandler.execute(
        {
          path: this.cwd,
          recursive: 'true',
        },
        {
          ...this.createTaskConfig(),
          callbacks: {
            ...this.createTaskConfig().callbacks,
            // 自动批准，不需要用户确认
            shouldAutoApproveTool: () => true,
          },
        }
      );

      return typeof result === 'string' ? result : '';
    } catch (error: any) {
      throw new Error(`Failed to list project files: ${error.message}`);
    }
  }

  /**
   * 执行 API 请求
   */
  private async executeApiRequest(
    systemPrompt: string, 
    messages: Anthropic.MessageParam[],
    onTokenUpdate?: (totalTokens: number) => void
  ): Promise<string> {
    let fullText = '';

    try {
      for await (const chunk of this.api.createMessage(systemPrompt, messages)) {
        if (chunk.type === 'text') {
          fullText += chunk.text;
          // 实时输出
          process.stdout.write(chunk.text);
        } else if (chunk.type === 'reasoning') {
          // 推理过程
          process.stdout.write(chunk.reasoning);
        } else if (chunk.type === 'usage' && onTokenUpdate) {
          // 更新token使用情况
          const totalTokens = chunk.inputTokens + chunk.outputTokens;
          onTokenUpdate(totalTokens);
        }
      }

      return fullText;
    } catch (error: any) {
      throw new Error(`API 请求失败: ${error.message}`);
    }
  }

  /**
   * 执行工具调用（增强版 - 包含追踪和 Focus Chain）
   */
  private async executeToolUse(toolUse: ToolUse, config: TaskConfig): Promise<ToolResponse> {
    const startTime = Date.now();
    let success = false;
    let result: ToolResponse;

    try {
      console.log(`   参数: ${JSON.stringify(toolUse.params, null, 2)}`);

      // 使用协调器执行工具
      result = await this.coordinator.execute(
        toolUse.name,
        toolUse.params,
        config
      );

      success = true;

      // 更新 Focus Chain（如果工具返回了 task_progress）
      const taskProgress = (toolUse.params as any).task_progress;
      if (taskProgress) {
        await this.featuresManager.updateFocusChain(taskProgress);
      }

      // 关键操作后自动创建检查点
      const criticalTools = ['write_to_file', 'replace_in_file', 'execute_command'];
      if (criticalTools.includes(toolUse.name as string) && this.taskState.didEditFile) {
        if (this.featuresManager.shouldCreateAutoCheckpoint('file_edit')) {
          await this.createAutoCheckpoint(`After ${toolUse.name}: ${toolUse.params.path || 'command'}`);
        }
      }

      // 显示结果
      const resultPreview = typeof result === 'string' 
        ? result.substring(0, 200) + (result.length > 200 ? '...' : '')
        : JSON.stringify(result).substring(0, 200);
      console.log(`   ✓ 结果: ${resultPreview}`);

      return result;
    } catch (error: any) {
      console.error(`   ❌ 错误: ${error.message}`);
      result = `工具执行错误: ${error.message}`;
      return result;
    } finally {
      // 记录工具执行
      const duration = Date.now() - startTime;
      this.featuresManager.trackToolExecution(toolUse.name as string, success, duration);
    }
  }

  /**
   * 处理 AI 响应（增强版 - 使用 ToolResultHandler）
   */
  private async handleResponse(response: string, config: TaskConfig): Promise<boolean> {
    // 解析响应
    const parsed = parseAssistantMessageV2(response);

    let hasToolUse = false;
    let shouldContinue = false;
    let toolUsedFlag = false;

    // 处理每个元素
    for (const item of parsed) {
      if (item.type === 'text') {
        // 文本内容已经在 executeApiRequest 中输出
        continue;
      } else if (item.type === 'tool_use') {
        hasToolUse = true;
        console.log(`\n\n🔧 执行工具: ${item.name}`);

        // 执行工具
        const toolResult = await this.executeToolUse(item, config);

        // 使用 ToolResultHandler 推送结果
        ToolResultHandler.pushToolResult(
          toolResult,
          item,
          this.taskState.userMessageContent,
          (block) => `[${block.name}]`,
          () => { toolUsedFlag = true; },
          this.coordinator
        );

        // 检查是否是完成任务
        if (item.name === 'attempt_completion') {
          console.log('\n✅ 任务完成！');
          
          // 检查 Focus Chain 未完成项
          this.featuresManager.checkIncompleteProgress();
          
          // 清理资源
          await this.dispose();
          
          return false; // 不继续
        }

        shouldContinue = true;
      }
    }

    return shouldContinue;
  }

  /**
   * 管理上下文窗口（使用智能压缩）
   */
  private async manageContextWindow(totalTokens: number): Promise<void> {
    // 使用 ContextManager 的智能压缩功能
    if (totalTokens > 0 && this.contextManager.shouldCompactContextWindow(totalTokens, this.api, 0.8)) {
      console.log('\n🔄 上下文窗口接近限制，执行智能优化...');
      
      const result = await this.contextManager.getNewContextMessagesAndMetadata(
        this.conversationHistory,
        this.api,
        undefined, // conversationHistoryDeletedRange
        totalTokens,
        this.taskId
      );
      
      if (result.updatedConversationHistoryDeletedRange) {
        this.conversationHistory = result.truncatedConversationHistory;
        console.log(`   ✓ 已优化上下文，保留 ${this.conversationHistory.length} 条消息`);
      } else {
        console.log('   ✓ 通过智能压缩优化了上下文，无需截断');
      }
    }
  }

  /**
   * 创建自动检查点
   */
  private async createAutoCheckpoint(message: string): Promise<void> {
    try {
      const { createCheckpointManager } = await import('../checkpoints/cli-exports');
      const manager = createCheckpointManager(this.taskId, this.cwd);
      const hash = await manager.saveCheckpoint(message);
      if (hash) {
        console.log(`📸 自动检查点已创建: ${hash.substring(0, 8)}`);
      }
    } catch (error) {
      console.warn('⚠️  自动检查点创建失败:', error);
      // 不影响主流程
    }
  }

  /**
   * 错误恢复机制
   */
  private async handleError(error: any, retryCount: number = 0): Promise<boolean> {
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      console.error('\n❌ 达到最大重试次数，任务失败');
      return false;
    }

    console.log(`\n⚠️  错误发生，尝试重试 (${retryCount + 1}/${maxRetries})...`);
    
    // 等待一段时间后重试
    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
    
    return true;
  }

  /**
   * 主执行循环（增强版 - 包含高级功能）
   */
  async run(userMessage: string, retryCount: number = 0, totalTokens: number = 0): Promise<void> {
    const config = this.createTaskConfig();

    try {
      // 0. 初始化高级功能（只在第一次调用时）
      const isFirstRequest = this.conversationHistory.filter(m => m.role === 'assistant').length === 0;
      if (isFirstRequest) {
        await this.featuresManager.initialize();
        this.featuresManager.printFeatureStatus();
      }

      // 0.1 每次都加载文件详情，让 AI 始终知道当前目录结构
      // 文件树很小（只是路径和文件名），不会显著影响上下文窗口
      const includeFileDetails = true;

      // 增加 API 请求计数
      TaskStateExtensions.incrementApiRequestCount(this.taskState);

      // 1. 管理上下文窗口（传递token使用情况）
      await this.manageContextWindow(totalTokens);

      // 2. 自动检查点：第一次请求前创建初始检查点
      if (isFirstRequest && this.featuresManager.shouldCreateAutoCheckpoint('first_request')) {
        await this.createAutoCheckpoint('Initial state before first API request');
      }

      // 3. 构建系统提示词（包含 Focus Chain 指令和文件列表）
      const systemPrompt = await this.buildSystemPrompt(includeFileDetails);

      // 4. 添加用户消息
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // 5. 执行 API 请求
      console.log('\n🤖 AI 回复:\n');
      let currentTotalTokens = 0;
      const response = await this.executeApiRequest(systemPrompt, this.conversationHistory, (tokens) => {
        currentTotalTokens = tokens;
      });

      // 6. 添加 AI 响应到历史
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
      });

      // 7. 处理响应和工具调用
      const shouldContinue = await this.handleResponse(response, config);

      // 8. 如果有工具调用，继续循环
      if (shouldContinue && this.taskState.userMessageContent.length > 0) {
        // 构建工具结果消息
        const toolResultContent: any[] = [];
        
        for (const item of this.taskState.userMessageContent) {
          toolResultContent.push(item);
        }

        // 清空工具结果
        this.taskState.userMessageContent = [];

        // 构建工具结果消息
        this.conversationHistory.push({
          role: 'user',
          content: toolResultContent,
        });

        // 递归调用（传递空字符串和当前token使用情况）
        await this.run('', 0, currentTotalTokens);
      }

    } catch (error: any) {
      console.error('\n\u274c 错误:', error.message);
      
      // 尝试错误恢复
      const shouldRetry = await this.handleError(error, retryCount);
      if (shouldRetry) {
        await this.run(userMessage, retryCount + 1, totalTokens);
      } else {
        throw error;
      }
    }
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(): Anthropic.MessageParam[] {
    return this.conversationHistory;
  }

  /**
   * 获取任务状态
   */
  getTaskState(): TaskState {
    return this.taskState;
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // 清理文件追踪器
    await this.fileTracker.dispose();
    
    // 清理高级功能
    await this.featuresManager.dispose();
  }

  /**
   * 获取文件追踪器（供工具处理器使用）
   */
  getFileTracker(): FileContextTracker {
    return this.fileTracker;
  }

  /**
   * 获取功能管理器
   */
  getFeaturesManager(): FeaturesManager {
    return this.featuresManager;
  }
}
