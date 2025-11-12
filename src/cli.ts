#!/usr/bin/env node

import { Command } from 'commander';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { getConfigValue, setConfigValue, listConfig, getConfigPath, loadConfig } from './utils/config';
import { fileExists, safeReadFile, formatFileSize, getFileSize } from './utils/fs';
import { ApiHandler } from './api/handler';
import { ContextManager } from './core/context/manager';
import { SessionManager, SessionMetadata } from './core/storage/session';
import { HistoryStorage } from './core/storage/history';
import { TaskExecutor } from './core/task/executor';
import { handleAndFormatError } from './utils/error-handler';
import { getGlobalCougarRules } from './core/rules/global-rules';
import { getLocalCougarRules } from './core/rules/local-rules';
import {
  getAllSessions,
  getSessionInfo,
  deleteSession,
  clearSessionHistory,
  exportSession,
  formatTimestamp,
  formatBytes,
  getSessionSize,
} from './core/storage/session-utils';
import { getGlobalWorkflows } from './core/rules/workflow';
import { trackModelUsage, getUsedModels } from './core/tracking/model-tracker';
import { getTrackedFiles, getStaleFileWarning, trackFileRead } from './core/tracking/file-tracker';
import { formatResponse, newTaskToolResponse, condenseToolResponse, summarizeTask, loadMcpDocumentation } from './prompts/runtime';
import { Spinner, withSpinner } from './utils/progress';
import { createCheckpointManager } from './core/checkpoints/cli-exports';

const program = new Command();

program
  .name('cougar')
  .description('Cougar CLI - AI助手命令行工具')
  .version('0.1.0');

// 配置管理命令
const configCmd = program
  .command('config')
  .description('管理配置 (子命令: set, get, list)');

// config set <key> <value>
configCmd
  .command('set <key> <value>')
  .description('设置配置项')
  .action(async (key: string, value: string) => {
    try {
      // 尝试解析为数字或布尔值
      let parsedValue: any = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(Number(value))) parsedValue = Number(value);
      
      setConfigValue(key, parsedValue);
      console.log(`✓ 已设置 ${key} = ${parsedValue}`);
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'config set', key, value });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// config get <key>
configCmd
  .command('get <key>')
  .description('获取配置项')
  .action((key: string) => {
    const value = getConfigValue(key);
    if (value === undefined) {
      console.log(`配置项 ${key} 不存在`);
    } else {
      console.log(value);
    }
  });

// config list
configCmd
  .command('list')
  .description('列出所有配置')
  .action(() => {
    const config = listConfig();
    const entries = Object.entries(config);
    
    if (entries.length === 0) {
      console.log('暂无配置');
      console.log(`\n配置文件位置: ${getConfigPath()}`);
      return;
    }
    
    console.log('当前配置:');
    entries.forEach(([key, value]) => {
      // 隐藏敏感信息（API密钥）
      if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
        const strValue = String(value);
        const masked = strValue.substring(0, 8) + '***' + strValue.substring(strValue.length - 4);
        console.log(`  ${key}: ${masked}`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
    console.log(`\n配置文件位置: ${getConfigPath()}`);
  });

// chat 命令 - 与AI对话
program
  .command('chat <message>')
  .description('与AI进行对话 | 特殊命令: /newtask, /condense, /summarize | 选项: --session, --new-session, -s, --use-rules, --use-local-rules, --use-workflows, --no-context, --tools, --auto-approve')
  .option('--session <id>', '指定会话ID（默认: default）')
  .option('--new-session', '创建新会话')
  .option('-s, --system <prompt>', '自定义系统提示词')
  .option('--use-rules', '启用全局规则')
  .option('--use-local-rules', '启用项目本地规则')
  .option('--use-workflows', '启用工作流')
  .option('--no-context', '禁用上下文管理（不保存历史）')
  .option('--tools', '启用工具执行模式（AI可以调用文件操作、命令执行等工具）')
  .option('--auto-approve', '自动批准所有工具操作（危险！仅用于可信任的任务）')
  .action(async (message: string, options: {
    system?: string;
    session?: string;
    newSession?: boolean;
    useRules?: boolean;
    useLocalRules?: boolean;
    useWorkflows?: boolean;
    context?: boolean;
    tools?: boolean;
    autoApprove?: boolean;
  }) => {
    // 声明 sessionId 在外部，以便 catch 块可以访问
    let sessionId: string = 'unknown';
    
    try {
      // 读取配置
      const config = loadConfig();
      
      if (!config.api?.apiKey || !config.api?.baseUrl || !config.api?.modelId) {
        const error = new Error('配置不完整，请先设置 API 配置');
        const errorMsg = await handleAndFormatError(error, { command: 'chat', issue: 'missing_config' });
        console.error(errorMsg);
        console.error('\n请运行以下命令设置：');
        console.error('  cougar config set api.apiKey <your-key>');
        console.error('  cougar config set api.baseUrl <api-url>');
        console.error('  cougar config set api.modelId <model-id>');
        process.exit(1);
      }

      // 初始化会话
      // 默认使用 'default' 会话，除非指定 --new-session 或 --session
      if (options.session) {
        sessionId = options.session;
      } else if (options.newSession) {
        sessionId = Date.now().toString();
        console.log('✨ 创建新会话');
      } else {
        sessionId = 'default';
      }
      const sessionMgr = new SessionManager(sessionId);
      await sessionMgr.initialize();

      // 初始化存储
      const historyStorage = new HistoryStorage(sessionId);
      const contextMgr = new ContextManager();
      await contextMgr.loadContextHistory(sessionId);

      // 构建系统提示词
      let systemPrompt = options.system || `你是 Cougar，一个强大的 AI 编程助手。

重要约束：
- 当被问及代码实现、API 使用、文件结构等技术细节时，你必须先使用工具（如 read_file、search_files、list_files）获取准确信息
- 不要基于推测或一般知识回答技术问题
- 如果无法访问必要的文件，明确告知用户这一限制
- 只有在确认实际实现后才提供技术答案`;
      
      // 添加全局规则
      if (options.useRules) {
        const globalRules = await getGlobalCougarRules({});
        if (globalRules) {
          systemPrompt += `\n\n${globalRules}`;
          console.log('✅ 已加载全局规则');
        }
      }
      
      // 添加本地规则
      if (options.useLocalRules) {
        const cwd = process.cwd();
        const localRules = await getLocalCougarRules(cwd, {});
        if (localRules) {
          systemPrompt += `\n\n${localRules}`;
          console.log('✅ 已加载项目规则');
        }
      }
      
      // 添加工作流
      if (options.useWorkflows) {
        const globalWorkflows = await getGlobalWorkflows({});
        if (globalWorkflows) {
          systemPrompt += `\n\n${globalWorkflows}`;
          console.log('✅ 已加载工作流');
        }
      }

      // 检查过期文件警告（同时用于显示和注入系统提示词）
      const staleWarning = await getStaleFileWarning(sessionId);
      if (staleWarning) {
        // 注入到系统提示词
        systemPrompt += `\n\n# 文件状态警告\n\n${staleWarning}`;
      }

      // 创建 API Handler
      const spinner = new Spinner('初始化 API 连接...');
      spinner.start();
      const handler = new ApiHandler({
        apiKey: config.api.apiKey,
        baseUrl: config.api.baseUrl,
        modelId: config.api.modelId,
        temperature: config.api.temperature,
      });
      spinner.stop('✓ API 连接就绪');

      // 加载对话历史
      const history = await withSpinner(
        historyStorage.load(),
        '加载对话历史...',
        '✓ 历史加载完成'
      );
      
      // 检查特殊命令
      let actualMessage = message;
      let isSpecialCommand = false;
      
      if (message.startsWith('/newtask')) {
        // 使用 /newtask 命令
        const instruction = newTaskToolResponse();
        const userInput = message.substring(8).trim(); // 移除 "/newtask" 前缀
        actualMessage = instruction + (userInput ? `\n\n${userInput}` : '');
        isSpecialCommand = true;
        console.log('✨ 特殊命令: /newtask - 创建新任务');
      } else if (message.startsWith('/condense')) {
        // 使用 /condense 命令
        const instruction = condenseToolResponse();
        const userInput = message.substring(9).trim();
        actualMessage = instruction + (userInput ? `\n\n${userInput}` : '');
        isSpecialCommand = true;
        console.log('🗜️  特殊命令: /condense - 压缩上下文');
      } else if (message.startsWith('/summarize')) {
        // 使用 /summarize 命令
        const instruction = summarizeTask();
        const userInput = message.substring(10).trim();
        actualMessage = instruction + (userInput ? `\n\n${userInput}` : '');
        isSpecialCommand = true;
        console.log('📝 特殊命令: /summarize - 总结任务');
      }
      
      console.log(`🤖 模型: ${config.api.modelId}`);
      console.log(`💾 会话: ${sessionId}`);
      if (history.length > 0) {
        console.log(`📊 历史消息: ${history.length} 条`);
      }
      if (options.tools) {
        console.log(`🔧 工具模式: 已启用 ${options.autoApprove ? '(自动批准)' : '(需要确认)'}`);
      }
      
      // 显示过期文件警告（已在上面检查过）
      if (staleWarning) {
        console.log('\n⚠️  文件警告:');
        console.log(staleWarning);
        console.log('');
      }
      
      if (!isSpecialCommand) {
        console.log(`💬 用户: ${message}\n`);
      }

      let totalTokens = 0;

      // 根据是否启用工具模式选择不同的执行路径
      if (options.tools) {
        // ========== 工具执行模式 ==========
        console.log('🔄 AI 工作中...\n');
        
        // 创建 TaskExecutor
        const executor = new TaskExecutor({
          taskId: sessionId,
          cwd: process.cwd(),
          apiHandler: handler,
          contextManager: contextMgr,
          onSay: async (type: string, text?: string) => {
            if (text) {
              console.log(`\n💬 ${text}`);
            }
            return Date.now();
          },
          onAsk: async (type: string, text?: string) => {
            if (options.autoApprove) {
              console.log(`\n✓ 自动批准: ${text}`);
              return {
                response: 'yesButtonClicked' as any,
                text: '',
                images: [],
                files: [],
              };
            }
            
            // 交互式确认
            console.log(`\n❓ ${text}`);
            const readline = await import('readline');
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
            });
            
            return new Promise((resolve) => {
              rl.question('   批准? (y/n): ', (answer) => {
                rl.close();
                const approved = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
                resolve({
                  response: approved ? ('yesButtonClicked' as any) : ('messageResponse' as any),
                  text: answer,
                  images: [],
                  files: [],
                });
              });
            });
          },
        });

        // 加载历史消息到 executor
        const executorHistory = executor.getConversationHistory();
        history.forEach((msg: any) => executorHistory.push(msg));

        // 执行任务
        await executor.run(actualMessage);

        // 获取更新后的历史
        const updatedHistory = executor.getConversationHistory();
        
        // 保存历史
        await historyStorage.save(updatedHistory);
        
        // 获取任务状态
        const taskState = executor.getTaskState();
        totalTokens = taskState.apiRequestCount * 1000; // 估算

      } else {
        // ========== 纯对话模式 ==========
        console.log('🔄 AI回复:\n');
        
        let fullText = '';
        let hasReasoning = false;
        
        // 合并历史消息和当前消息
        const allMessages: Anthropic.MessageParam[] = [
          ...(history as Anthropic.MessageParam[]),
          {
            role: 'user',
            content: actualMessage,
          } as Anthropic.MessageParam
        ];
        
        // 流式输出
        for await (const chunk of handler.createMessage(systemPrompt, allMessages)) {
          if (chunk.type === 'text') {
            process.stdout.write(chunk.text);
            fullText += chunk.text;
          } else if (chunk.type === 'reasoning') {
            if (!hasReasoning) {
              console.log('\n\n🧠 推理过程:\n');
              hasReasoning = true;
            }
            process.stdout.write(chunk.reasoning);
          } else if (chunk.type === 'usage') {
            totalTokens = chunk.inputTokens + chunk.outputTokens;
            console.log('\n\n📊 Token使用:');
            console.log(`  输入: ${chunk.inputTokens} tokens`);
            console.log(`  输出: ${chunk.outputTokens} tokens`);
            console.log(`  总计: ${totalTokens} tokens`);
            if (chunk.cacheReadTokens) {
              console.log(`  缓存读取: ${chunk.cacheReadTokens} tokens`);
            }
          }
        }
      }

      // 上下文管理和元数据保存
      if (options.context !== false) {
        // 使用新的主入口方法：智能优化 + 自动截断
        const updatedHistory = await historyStorage.load();
        const result = await contextMgr.getNewContextMessagesAndMetadata(
          updatedHistory,
          handler,
          undefined, // conversationHistoryDeletedRange
          totalTokens,
          sessionId
        );
        
        // 如果进行了截断，保存截断后的历史
        if (result.updatedConversationHistoryDeletedRange) {
          const truncationNotice = formatResponse.contextTruncationNotice();
          console.log('\n⚠️  ' + truncationNotice);
          await historyStorage.save(result.truncatedConversationHistory);
        }
        
        // 更新会话元数据
        const metadata: SessionMetadata = {
          id: sessionId,
          createdAt: (await sessionMgr.loadMetadata())?.createdAt || Date.now(),
          lastActiveAt: Date.now(),
          messageCount: (await historyStorage.load()).length,
          modelId: config.api.modelId,
          totalTokens,
        };
        await sessionMgr.saveMetadata(metadata);
        
        // 记录模型使用
        await trackModelUsage(
          sessionId,
          config.api.modelId,
          config.api.baseUrl || 'openai',
          options.tools ? 'tools' : 'chat'
        );
      }

      console.log('\n');
    } catch (error: any) {
      // 使用增强的错误处理器
      const errorMsg = await handleAndFormatError(error, {
        command: 'chat',
        sessionId,
        message: message.substring(0, 50),
      });
      console.error('\n' + errorMsg);
      process.exit(1);
    }
  });

// ========================================
// sessions 命令组 - 会话管理
// ========================================
const sessionsCmd = program
  .command('sessions')
  .description('管理对话会话 (子命令: list, show, clear, delete, export)');

// sessions list - 列出所有会话
sessionsCmd
  .command('list')
  .description('列出所有会话 (选项: -v/--verbose 显示详细信息)')
  .option('-v, --verbose', '显示详细信息')
  .action(async (options: { verbose?: boolean }) => {
    try {
      const sessions = await getAllSessions();
      
      if (sessions.length === 0) {
        console.log('📭 暂无会话');
        return;
      }
      
      console.log(`\n📚 共 ${sessions.length} 个会话:\n`);
      
      for (const sessionId of sessions) {
        const info = await getSessionInfo(sessionId);
        const size = await getSessionSize(sessionId);
        
        if (options.verbose) {
          console.log(`📂 ${sessionId}`);
          if (info.metadata) {
            console.log(`   创建时间: ${formatTimestamp(info.metadata.createdAt)}`);
            console.log(`   最后活跃: ${formatTimestamp(info.metadata.lastActiveAt)}`);
            console.log(`   消息数量: ${info.messageCount} 条`);
            console.log(`   使用模型: ${info.metadata.modelId}`);
            console.log(`   总 Token: ${info.metadata.totalTokens}`);
            console.log(`   占用空间: ${formatBytes(size)}`);
          }
          console.log('');
        } else {
          const lastActive = info.metadata 
            ? formatTimestamp(info.metadata.lastActiveAt)
            : '未知';
          console.log(`  📂 ${sessionId.padEnd(20)} | ${info.messageCount} 条消息 | ${lastActive}`);
        }
      }
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// sessions show <id> - 显示会话详情
sessionsCmd
  .command('show <sessionId>')
  .description('显示会话详细信息')
  .action(async (sessionId: string) => {
    try {
      const info = await getSessionInfo(sessionId);
      
      if (!info.exists) {
        const error = new Error(`会话不存在: ${sessionId}`);
        const errorMsg = await handleAndFormatError(error, { command: 'sessions show', sessionId });
        console.error(errorMsg);
        process.exit(1);
      }
      
      const size = await getSessionSize(sessionId);
      
      console.log(`\n📂 会话: ${sessionId}\n`);
      
      if (info.metadata) {
        console.log('📊 基本信息:');
        console.log(`  创建时间: ${formatTimestamp(info.metadata.createdAt)}`);
        console.log(`  最后活跃: ${formatTimestamp(info.metadata.lastActiveAt)}`);
        console.log(`  消息数量: ${info.messageCount} 条`);
        console.log(`  使用模型: ${info.metadata.modelId}`);
        console.log(`  总 Token: ${info.metadata.totalTokens}`);
        console.log(`  占用空间: ${formatBytes(size)}`);
      }
      
      // 显示最近几条消息
      const historyStorage = new HistoryStorage(sessionId);
      const history = await historyStorage.load();
      
      if (history.length > 0) {
        console.log('\n💬 最近消息:');
        const recentMessages = history.slice(-3);
        recentMessages.forEach((msg, index) => {
          const content = typeof msg.content === 'string' 
            ? msg.content 
            : JSON.stringify(msg.content);
          const preview = content.length > 60 
            ? content.substring(0, 60) + '...' 
            : content;
          console.log(`  ${msg.role === 'user' ? '👤' : '🤖'} ${preview}`);
        });
      }
      
      console.log('');
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// sessions clear [id] - 清空会话历史
sessionsCmd
  .command('clear [sessionId]')
  .description('清空会话历史（默认清空 default 会话）')
  .action(async (sessionId?: string) => {
    try {
      const targetSession = sessionId || 'default';
      
      const success = await clearSessionHistory(targetSession);
      
      if (success) {
        console.log(`✅ 已清空会话历史: ${targetSession}`);
      } else {
        const error = new Error(`会话不存在: ${targetSession}`);
        const errorMsg = await handleAndFormatError(error, { command: 'sessions clear', sessionId: targetSession });
        console.error(errorMsg);
        process.exit(1);
      }
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// sessions delete <id> - 删除会话
sessionsCmd
  .command('delete <sessionId>')
  .description('删除会话')
  .option('-f, --force', '强制删除，不询问确认')
  .action(async (sessionId: string, options: { force?: boolean }) => {
    try {
      // 防止删除 default 会话
      if (sessionId === 'default' && !options.force) {
        const error = new Error('不能删除 default 会话，请使用 --force 强制删除');
        const errorMsg = await handleAndFormatError(error, { command: 'sessions delete', sessionId });
        console.error(errorMsg);
        process.exit(1);
      }
      
      const info = await getSessionInfo(sessionId);
      if (!info.exists) {
        const error = new Error(`会话不存在: ${sessionId}`);
        const errorMsg = await handleAndFormatError(error, { command: 'sessions show', sessionId });
        console.error(errorMsg);
        process.exit(1);
      }
      
      // 确认删除
      if (!options.force) {
        console.log(`⚠️  即将删除会话: ${sessionId}`);
        console.log(`   消息数量: ${info.messageCount} 条`);
        console.log('   请使用 --force 确认删除');
        process.exit(0);
      }
      
      const success = await deleteSession(sessionId);
      
      if (success) {
        console.log(`✅ 已删除会话: ${sessionId}`);
      } else {
        const error = new Error(`删除会话失败: ${sessionId}`);
        const errorMsg = await handleAndFormatError(error, { command: 'sessions delete', sessionId });
        console.error(errorMsg);
        process.exit(1);
      }
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// sessions export <id> - 导出会话
sessionsCmd
  .command('export <sessionId>')
  .description('导出会话为 JSON 文件')
  .option('-o, --output <file>', '输出文件路径')
  .action(async (sessionId: string, options: { output?: string }) => {
    try {
      const data = await exportSession(sessionId);
      
      if (!data) {
        const error = new Error(`会话不存在: ${sessionId}`);
        const errorMsg = await handleAndFormatError(error, { command: 'sessions export', sessionId });
        console.error(errorMsg);
        process.exit(1);
      }
      
      if (options.output) {
        await fs.writeFile(options.output, data, 'utf8');
        console.log(`✅ 已导出到: ${options.output}`);
      } else {
        console.log(data);
      }
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// ========================================
// new 命令 - 快速创建新会话
// ========================================
program
  .command('new [message]')
  .description('创建新会话并开始对话')
  .option('-s, --system <prompt>', '系统提示词')
  .option('--use-rules', '启用全局规则')
  .option('--use-local-rules', '启用项目本地规则')
  .action(async (message?: string, options?: any) => {
    const newSessionId = Date.now().toString();
    console.log(`✨ 创建新会话: ${newSessionId}\n`);
    
    if (message) {
      // 如果提供了消息，直接开始对话
      const chatOptions = {
        ...options,
        session: newSessionId,
      };
      
      // 重用 chat 命令的逻辑
      program.parse(['node', 'cli.js', 'chat', message, '--session', newSessionId]);
    } else {
      console.log('💡 提示: 使用以下命令继续对话:');
      console.log(`   cline chat "你的消息" --session ${newSessionId}`);
    }
  });

// ========================================
// reset 命令 - 重置会话
// ========================================
program
  .command('reset [sessionId]')
  .description('重置会话历史（默认重置 default 会话）')
  .action(async (sessionId?: string) => {
    try {
      const targetSession = sessionId || 'default';
      const success = await clearSessionHistory(targetSession);
      
      if (success) {
        console.log(`✅ 已重置会话: ${targetSession}`);
        console.log('💡 可以开始新的对话了');
      } else {
        const error = new Error(`会话不存在: ${targetSession}`);
        const errorMsg = await handleAndFormatError(error, { command: 'sessions clear', sessionId: targetSession });
        console.error(errorMsg);
        process.exit(1);
      }
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// ========================================
// stats 命令 - 查看会话统计
// ========================================
program
  .command('stats [sessionId]')
  .description('查看会话统计信息（默认查看 default 会话）')
  .action(async (sessionId?: string) => {
    try {
      const targetSession = sessionId || 'default';
      
      // 检查会话是否存在
      const info = await getSessionInfo(targetSession);
      if (!info.exists) {
        console.error(`❌ 会话不存在: ${targetSession}`);
        process.exit(1);
      }
      
      console.log(`\n📊 会话统计 (${targetSession})\n`);
      
      // 基本信息
      if (info.metadata) {
        console.log('📈 基本统计:');
        console.log(`  消息数量: ${info.messageCount} 条`);
        console.log(`  总 Token: ${info.metadata.totalTokens}`);
        console.log(`  当前模型: ${info.metadata.modelId}`);
        console.log(`  创建时间: ${formatTimestamp(info.metadata.createdAt)}`);
        console.log(`  最后活跃: ${formatTimestamp(info.metadata.lastActiveAt)}`);
        console.log('');
      }
      
      // 模型使用统计
      const usedModels = await getUsedModels(targetSession);
      if (usedModels.length > 0) {
        console.log('🤖 使用过的模型:');
        usedModels.forEach(model => {
          console.log(`  - ${model.modelId} (${model.providerId})`);
          if (model.mode) {
            console.log(`    模式: ${model.mode}`);
          }
          console.log(`    首次使用: ${formatTimestamp(model.firstUsedAt)}`);
          console.log(`    最后使用: ${formatTimestamp(model.lastUsedAt)}`);
          console.log('');
        });
      } else {
        console.log('🤖 暂无模型使用记录\n');
      }
      
      // 文件追踪统计
      const trackedFiles = await getTrackedFiles(targetSession);
      if (trackedFiles.length > 0) {
        console.log(`📁 追踪的文件 (${trackedFiles.length} 个):`);
        
        const readFiles = trackedFiles.filter(f => f.state === 'read');
        const editedFiles = trackedFiles.filter(f => f.state === 'edited');
        const createdFiles = trackedFiles.filter(f => f.state === 'created');
        
        if (readFiles.length > 0) {
          console.log(`\n  📖 已读取 (${readFiles.length}):`);
          readFiles.slice(0, 5).forEach(f => {
            console.log(`    - ${f.path}`);
            console.log(`      来源: ${f.source} | 时间: ${formatTimestamp(f.readDate || Date.now())}`);
          });
          if (readFiles.length > 5) {
            console.log(`    ... 还有 ${readFiles.length - 5} 个`);
          }
        }
        
        if (editedFiles.length > 0) {
          console.log(`\n  ✏️  已编辑 (${editedFiles.length}):`);
          editedFiles.slice(0, 5).forEach(f => {
            console.log(`    - ${f.path}`);
            console.log(`      来源: ${f.source} | 时间: ${formatTimestamp(f.editedDate || Date.now())}`);
          });
          if (editedFiles.length > 5) {
            console.log(`    ... 还有 ${editedFiles.length - 5} 个`);
          }
        }
        
        if (createdFiles.length > 0) {
          console.log(`\n  🆕 已创建 (${createdFiles.length}):`);
          createdFiles.slice(0, 5).forEach(f => {
            console.log(`    - ${f.path}`);
            console.log(`      来源: ${f.source} | 时间: ${formatTimestamp(f.editedDate || Date.now())}`);
          });
          if (createdFiles.length > 5) {
            console.log(`    ... 还有 ${createdFiles.length - 5} 个`);
          }
        }
        
        // 检查过期文件
        const staleWarning = await getStaleFileWarning(targetSession);
        if (staleWarning) {
          console.log('\n⚠️  过期文件警告:');
          console.log(staleWarning.split('\n').map(line => '  ' + line).join('\n'));
        }
        
        console.log('');
      } else {
        console.log('📁 暂无文件追踪记录\n');
      }
      
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// ========================================
// read 命令 - 读取文件并追踪
// ========================================
program
  .command('read <file>')
  .description('读取文件内容并追踪到会话 (选项: -n <行数>, --session <id>, --no-track)')
  .option('-n, --lines <number>', '只显示前N行', '50')
  .option('--session <id>', '指定会话ID（默认: default）')
  .option('--no-track', '不追踪文件到会话')
  .action(async (filePath: string, options: { session?: string; lines?: string; track?: boolean }) => {
    try {
      const sessionId = options.session || 'default';
      const absolutePath = path.resolve(filePath);
      
      // 检查文件是否存在
      try {
        await fs.stat(absolutePath);
      } catch (error) {
        const err = new Error(`文件不存在: ${filePath}`);
        const errorMsg = await handleAndFormatError(err, { command: 'read', filePath });
        console.error(errorMsg);
        process.exit(1);
      }
      
      // 检查文件大小
      const fileSize = await getFileSize(absolutePath);
      
      // 安全读取文件
      const content = await safeReadFile(absolutePath, {
        warnOnLarge: true,
      });
      const lines = content.split('\n');
      
      console.log(`📄 文件: ${absolutePath}`);
      console.log(`📊 总行数: ${lines.length}`);
      console.log(`📋 文件大小: ${formatFileSize(fileSize)}`);
      
      if (options.track !== false) {
        console.log(`💾 会话: ${sessionId}`);
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
      
      // 显示内容
      const maxLines = options.lines ? parseInt(options.lines) : lines.length;
      const displayLines = lines.slice(0, maxLines);
      
      displayLines.forEach((line, index) => {
        console.log(`${(index + 1).toString().padStart(4)} | ${line}`);
      });
      
      if (maxLines < lines.length) {
        console.log(`\n... (还有 ${lines.length - maxLines} 行)`);
      }
      
      console.log('\n' + '='.repeat(60));
      
      // 追踪文件
      if (options.track !== false) {
        await trackFileRead(sessionId, absolutePath, 'user');
        console.log('\n✅ 已追踪文件到会话');
      }
      
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// ========================================
// history 命令 - 查看历史
// ========================================
program
  .command('history [sessionId]')
  .description('查看会话历史 (选项: -n <数量>, --full 显示完整内容)')
  .option('-n, --limit <number>', '限制显示的消息数量', '10')
  .option('--full', '显示完整消息内容')
  .action(async (sessionId?: string, options?: { limit?: string; full?: boolean }) => {
    try {
      const targetSession = sessionId || 'default';
      const historyStorage = new HistoryStorage(targetSession);
      const history = await historyStorage.load();
      
      if (history.length === 0) {
        console.log(`📭 会话 ${targetSession} 暂无历史记录`);
        return;
      }
      
      const limit = parseInt(options?.limit || '10');
      const messages = history.slice(-limit);
      
      console.log(`\n💬 会话历史 (${targetSession}) - 共 ${history.length} 条，显示最近 ${messages.length} 条:\n`);
      
      messages.forEach((msg, index) => {
        const icon = msg.role === 'user' ? '👤' : '🤖';
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content);
        
        if (options?.full) {
          console.log(`${icon} ${msg.role}:`);
          console.log(content);
          console.log('');
        } else {
          const preview = content.length > 100 
            ? content.substring(0, 100) + '...' 
            : content;
          console.log(`${icon} ${preview}\n`);
        }
      });
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });
// 最简单的命令：hello
program
  .command('hello')
  .description('打印问候语')
  .option('-n, --name <name>', '你的名字', 'World')
  .action((options) => {
    console.log(`Hello, ${options.name}! 👋`);
    console.log('欢迎使用 Cline CLI!');
  });

// ========================================
// mcp-docs 命令 - 显示MCP服务器开发文档
// ========================================
program
  .command('mcp-docs')
  .description('显示MCP服务器开发文档')
  .option('--save <file>', '保存文档到文件')
  .action(async (options: { save?: string }) => {
    try {
      const config = loadConfig();
      
      // 准备MCP配置
      const mcpConfig = {
        mcpServersPath: path.join(os.homedir(), '.cline', 'mcp-servers'),
        mcpSettingsFilePath: path.join(os.homedir(), '.cline', 'mcp-settings.json'),
        connectedServers: [],
      };
      
      // 加载MCP文档
      const docs = await loadMcpDocumentation(mcpConfig);
      
      if (options.save) {
        // 保存到文件
        await fs.writeFile(options.save, docs, 'utf8');
        console.log(`✅ MCP文档已保存到: ${options.save}`);
      } else {
        // 显示在控制台
        console.log('\n' + '='.repeat(80));
        console.log('📚 MCP服务器开发文档');
        console.log('='.repeat(80) + '\n');
        console.log(docs);
        console.log('\n' + '='.repeat(80));
        console.log('\n💡 提示: 使用 --save <文件名> 保存文档到文件');
      }
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'sessions list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// ========================================
// checkpoint 命令组 - Git 检查点管理
// ========================================
const checkpointCmd = program
  .command('checkpoint')
  .description('管理工作区检查点 (子命令: save, restore, list, diff, show)');

// checkpoint save - 保存检查点
checkpointCmd
  .command('save')
  .description('保存当前工作区为检查点')
  .option('--session <id>', '关联到会话ID（默认: default）')
  .option('-m, --message <msg>', '检查点描述信息')
  .action(async (options: { session?: string; message?: string }) => {
    try {
      const sessionId = options.session || 'default';
      
      console.log('📸 正在创建检查点...');
      
      const manager = createCheckpointManager(sessionId);
      const hash = await manager.saveCheckpoint(options.message);
      
      if (hash) {
        console.log(`✅ 检查点已保存: ${hash.substring(0, 8)}`);
        if (options.message) {
          console.log(`   描述: ${options.message}`);
        }
        console.log(`   会话: ${sessionId}`);
        console.log(`\n💡 使用以下命令恢复:`);
        console.log(`   cline checkpoint restore ${hash.substring(0, 8)} --force`);
      } else {
        throw new Error('创建检查点失败');
      }
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'checkpoint save' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// checkpoint restore <hash> - 恢复检查点
checkpointCmd
  .command('restore <hash>')
  .description('恢复工作区到指定检查点')
  .option('--session <id>', '指定会话ID（默认: default）')
  .option('-f, --force', '强制恢复，不确认')
  .action(async (hash: string, options: { session?: string; force?: boolean }) => {
    try {
      const sessionId = options.session || 'default';
      
      if (!options.force) {
        console.log('⚠️  即将恢复工作区到检查点:', hash);
        console.log('   这将会覆盖当前的工作区内容');
        console.log('   请使用 --force 确认恢复');
        process.exit(0);
      }
      
      console.log('🔄 正在恢复检查点...');
      
      const manager = createCheckpointManager(sessionId);
      await manager.restoreCheckpoint(hash);
      
      console.log(`✅ 已恢复到检查点: ${hash.substring(0, 8)}`);
      console.log('   工作区文件已更新');
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'checkpoint restore', hash });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// checkpoint list - 列出检查点
checkpointCmd
  .command('list')
  .description('列出所有检查点')
  .option('--session <id>', '指定会话ID（默认: default）')
  .option('-n, --limit <number>', '限制显示数量', '10')
  .action(async (options: { session?: string; limit?: string }) => {
    try {
      const sessionId = options.session || 'default';
      const limit = parseInt(options.limit || '10');
      
      const manager = createCheckpointManager(sessionId);
      const checkpoints = await manager.listCheckpoints(limit);
      
      if (checkpoints.length === 0) {
        console.log('📭 暂无检查点');
        console.log('\n💡 使用以下命令创建第一个检查点:');
        console.log('   cline checkpoint save -m "我的第一个检查点"');
        return;
      }
      
      console.log(`\n📚 检查点列表 (${sessionId}) - 共 ${checkpoints.length} 个:\n`);
      
      checkpoints.forEach((cp, index) => {
        console.log(`  ${index + 1}. ${cp.shortHash} - ${cp.date.toLocaleString()}`);
        console.log(`     ${cp.message}`);
        console.log('');
      });
      
      console.log('💡 提示:');
      console.log(`   查看详情: cline checkpoint show <hash>`);
      console.log(`   恢复: cline checkpoint restore <hash> --force`);
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'checkpoint list' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// checkpoint diff <hash1> [hash2] - 比较差异
checkpointCmd
  .command('diff <hash1> [hash2]')
  .description('比较检查点差异（如果只提供hash1，则与当前工作区比较）')
  .option('--session <id>', '指定会话ID（默认: default）')
  .option('--files-only', '只显示文件列表，不显示详细差异')
  .action(async (hash1: string, hash2: string | undefined, options: { session?: string; filesOnly?: boolean }) => {
    try {
      const sessionId = options.session || 'default';
      
      console.log('📊 正在比较差异...');
      
      const manager = createCheckpointManager(sessionId);
      const diffs = await manager.getCheckpointDiff(hash1, hash2);
      
      if (diffs.length === 0) {
        console.log('✅ 无差异');
        return;
      }
      
      console.log(`\n📝 差异文件 (${diffs.length} 个):\n`);
      
      diffs.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.relativePath}`);
        
        if (!options.filesOnly) {
          const totalChange = file.linesAdded + file.linesRemoved;
          const addedStr = file.linesAdded > 0 ? `+${file.linesAdded}` : '';
          const removedStr = file.linesRemoved > 0 ? `-${file.linesRemoved}` : '';
          const changeStr = [addedStr, removedStr].filter(Boolean).join(' ');
          console.log(`     变更: ${changeStr || '无变化'} 行`);
          console.log('');
        }
      });
      
      if (options.filesOnly) {
        console.log('\n💡 提示: 使用不带 --files-only 选项查看详细差异');
      }
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'checkpoint diff' });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// checkpoint show <hash> - 显示检查点详情
checkpointCmd
  .command('show <hash>')
  .description('显示检查点详细信息')
  .option('--session <id>', '指定会话ID（默认: default）')
  .action(async (hash: string, options: { session?: string }) => {
    try {
      const sessionId = options.session || 'default';
      
      const manager = createCheckpointManager(sessionId);
      const info = await manager.getCheckpointInfo(hash);
      
      if (!info) {
        throw new Error(`检查点不存在: ${hash}`);
      }
      
      const stats = await manager.getCheckpointStats(hash);
      
      console.log(`\n📸 检查点详情:\n`);
      console.log(`  Hash: ${info.hash}`);
      console.log(`  日期: ${info.date.toLocaleString()}`);
      console.log(`  消息: ${info.message}`);
      console.log(`  作者: ${info.author}`);
      console.log(`  会话: ${sessionId}`);
      console.log('');
      console.log(`  📊 统计:`);
      console.log(`     变更文件: ${stats.files} 个`);
      console.log(`     插入行数: +${stats.insertions}`);
      console.log(`     删除行数: -${stats.deletions}`);
      console.log('');
    } catch (error: any) {
      const errorMsg = await handleAndFormatError(error, { command: 'checkpoint show', hash });
      console.error(errorMsg);
      process.exit(1);
    }
  });

// 如果没有参数，显示帮助信息
if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);

