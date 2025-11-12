/**
 * 任务工具函数集合
 * 适配自 task/工具.ts，移除 VSCode 依赖
 * 
 * 功能：
 * - CLI 工具检测：自动检测系统可用的开发工具
 * - API 请求统计：更新和追踪 API 使用情况
 * - 通知管理：在 CLI 环境下输出通知信息
 */
import { execSync } from 'child_process';
import { ApiHandler } from '../../api/handler';
import { MessageStateHandler } from './message-handler';

/**
 * CLI 环境下的通知函数
 * 适配自原 showNotificationForApprovalIfAutoApprovalEnabled
 * 在 CLI 中使用 console 输出代替 VSCode 通知
 */
export function showNotificationForApprovalIfAutoApprovalEnabled(
  message: string,
  autoApprovalSettingsEnabled: boolean,
  notificationsEnabled: boolean,
): void {
  if (autoApprovalSettingsEnabled && notificationsEnabled) {
    console.log('\n⚠️  Approval Required:');
    console.log(`   ${message}`);
    console.log('');
  }
}

/**
 * API 请求消息更新参数
 */
export interface UpdateApiReqMsgParams {
  messageStateHandler: MessageStateHandler;
  lastApiReqIndex: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  totalCost?: number;
  api: ApiHandler;
  cancelReason?: string;
  streamingFailedMessage?: string;
}

/**
 * API 请求信息接口
 */
export interface ClineApiReqInfo {
  tokensIn?: number;
  tokensOut?: number;
  cacheWrites?: number;
  cacheReads?: number;
  cost?: number;
  cancelReason?: string;
  streamingFailedMessage?: string;
  retryStatus?: any;
  [key: string]: any;
}

/**
 * 更新 API 请求消息统计信息
 * 适配自原 updateApiReqMsg 函数
 */
export async function updateApiReqMsg(params: UpdateApiReqMsgParams): Promise<void> {
  const clineMessages = params.messageStateHandler.getClineMessages();
  const currentApiReqInfo: ClineApiReqInfo = JSON.parse(
    clineMessages[params.lastApiReqIndex].text || '{}'
  );
  
  // 清除请求完成时的重试状态
  delete currentApiReqInfo.retryStatus;

  await params.messageStateHandler.updateClineMessage(params.lastApiReqIndex, {
    text: JSON.stringify({
      ...currentApiReqInfo,
      tokensIn: params.inputTokens,
      tokensOut: params.outputTokens,
      cacheWrites: params.cacheWriteTokens,
      cacheReads: params.cacheReadTokens,
      cost: params.totalCost ?? calculateApiCost(
        params.inputTokens,
        params.outputTokens,
        params.cacheWriteTokens,
        params.cacheReadTokens,
      ),
      cancelReason: params.cancelReason,
      streamingFailedMessage: params.streamingFailedMessage,
    } satisfies ClineApiReqInfo),
  });
}

/**
 * 计算 API 调用成本（简化版）
 * 基于 Anthropic 的定价模型
 */
function calculateApiCost(
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens: number,
  cacheReadTokens: number,
): number {
  // 简化的成本计算（实际应该根据模型类型调整）
  const INPUT_PRICE = 3 / 1_000_000;  // $3 per million tokens
  const OUTPUT_PRICE = 15 / 1_000_000; // $15 per million tokens
  const CACHE_WRITE_PRICE = 3.75 / 1_000_000;
  const CACHE_READ_PRICE = 0.3 / 1_000_000;

  return (
    inputTokens * INPUT_PRICE +
    outputTokens * OUTPUT_PRICE +
    cacheWriteTokens * CACHE_WRITE_PRICE +
    cacheReadTokens * CACHE_READ_PRICE
  );
}

/**
 * 开发者常用的 CLI 工具列表
 */
const CLI_TOOLS = [
  'gh',
  'git',
  'docker',
  'podman',
  'kubectl',
  'aws',
  'gcloud',
  'az',
  'terraform',
  'pulumi',
  'npm',
  'yarn',
  'pnpm',
  'pip',
  'cargo',
  'go',
  'curl',
  'jq',
  'make',
  'cmake',
  'python',
  'node',
  'psql',
  'mysql',
  'redis-cli',
  'sqlite3',
  'mongosh',
  'code',
  'grep',
  'sed',
  'awk',
  'brew',
  'apt',
  'yum',
  'gradle',
  'mvn',
  'bundle',
  'dotnet',
  'helm',
  'ansible',
  'wget',
];

/**
 * 检测系统 PATH 中可用的 CLI 工具
 * 在 Unix 系统上使用 'which' 命令，在 Windows 系统上使用 'where' 命令
 * 
 * @returns 可用工具的名称数组
 */
export async function detectAvailableCliTools(): Promise<string[]> {
  const availableCommands: string[] = [];
  const isWindows = process.platform === 'win32';
  const checkCommand = isWindows ? 'where' : 'which';

  for (const command of CLI_TOOLS) {
    try {
      // 使用 execSync 检查命令是否存在
      execSync(`${checkCommand} ${command}`, {
        stdio: 'ignore', // 不输出到控制台
        timeout: 1000,   // 1秒超时避免挂起
      });
      availableCommands.push(command);
    } catch (error) {
      // 命令不存在，跳过
    }
  }

  return availableCommands;
}
