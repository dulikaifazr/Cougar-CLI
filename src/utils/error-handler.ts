/**
 * 错误处理工具
 * 提供统一的错误分类、格式化和日志功能
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * 错误类型
 */
export enum ErrorType {
  // API 相关
  API_ERROR = 'API_ERROR',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_TIMEOUT = 'API_TIMEOUT',
  API_AUTH = 'API_AUTH',
  
  // 文件操作
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_PERMISSION = 'FILE_PERMISSION',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  
  // 命令执行
  COMMAND_ERROR = 'COMMAND_ERROR',
  COMMAND_TIMEOUT = 'COMMAND_TIMEOUT',
  COMMAND_NOT_FOUND = 'COMMAND_NOT_FOUND',
  
  // 验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  
  // 配置错误
  CONFIG_ERROR = 'CONFIG_ERROR',
  CONFIG_MISSING = 'CONFIG_MISSING',
  
  // 其他
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * 错误级别
 */
export enum ErrorLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

/**
 * 结构化错误信息
 */
export interface StructuredError {
  type: ErrorType;
  level: ErrorLevel;
  message: string;
  details?: any;
  stack?: string;
  timestamp: number;
  context?: Record<string, any>;
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private static logDir: string = path.join(os.homedir(), '.cline', 'logs');
  private static enableLogging: boolean = true;

  /**
   * 分类错误
   */
  static classifyError(error: any): ErrorType {
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';
    const status = error.status || error.statusCode;

    // API 错误
    if (status === 429 || message.includes('rate limit')) {
      return ErrorType.API_RATE_LIMIT;
    }
    if (status === 401 || status === 403 || message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorType.API_AUTH;
    }
    if (message.includes('timeout') || code === 'etimedout') {
      return ErrorType.API_TIMEOUT;
    }
    if (status >= 400 && status < 600) {
      return ErrorType.API_ERROR;
    }

    // 文件错误
    if (code === 'enoent' || message.includes('no such file')) {
      return ErrorType.FILE_NOT_FOUND;
    }
    if (code === 'eacces' || message.includes('permission denied')) {
      return ErrorType.FILE_PERMISSION;
    }
    if (message.includes('read') && (code === 'eio' || message.includes('i/o'))) {
      return ErrorType.FILE_READ_ERROR;
    }
    if (message.includes('write') && (code === 'eio' || message.includes('i/o'))) {
      return ErrorType.FILE_WRITE_ERROR;
    }

    // 命令错误
    if (message.includes('command not found') || code === 'enoent') {
      return ErrorType.COMMAND_NOT_FOUND;
    }
    if (message.includes('command') && message.includes('timeout')) {
      return ErrorType.COMMAND_TIMEOUT;
    }
    if (message.includes('command') || message.includes('exec')) {
      return ErrorType.COMMAND_ERROR;
    }

    // 验证错误
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION_ERROR;
    }
    if (message.includes('security') || message.includes('dangerous') || message.includes('access denied')) {
      return ErrorType.SECURITY_ERROR;
    }

    // 配置错误
    if (message.includes('config') || message.includes('configuration')) {
      return ErrorType.CONFIG_ERROR;
    }

    // 网络错误
    if (code === 'econnrefused' || code === 'enotfound' || message.includes('network')) {
      return ErrorType.NETWORK_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * 确定错误级别
   */
  static determineLevel(type: ErrorType): ErrorLevel {
    switch (type) {
      case ErrorType.API_AUTH:
      case ErrorType.CONFIG_MISSING:
      case ErrorType.SECURITY_ERROR:
        return ErrorLevel.FATAL;
      
      case ErrorType.API_ERROR:
      case ErrorType.FILE_PERMISSION:
      case ErrorType.COMMAND_ERROR:
        return ErrorLevel.ERROR;
      
      case ErrorType.API_RATE_LIMIT:
      case ErrorType.API_TIMEOUT:
      case ErrorType.FILE_NOT_FOUND:
        return ErrorLevel.WARN;
      
      default:
        return ErrorLevel.ERROR;
    }
  }

  /**
   * 创建结构化错误
   */
  static createStructuredError(
    error: any,
    context?: Record<string, any>
  ): StructuredError {
    const type = this.classifyError(error);
    const level = this.determineLevel(type);

    return {
      type,
      level,
      message: error.message || String(error),
      details: error.details || error.response?.data,
      stack: error.stack,
      timestamp: Date.now(),
      context,
    };
  }

  /**
   * 格式化错误消息供用户显示
   */
  static formatErrorForUser(error: StructuredError): string {
    const emoji = this.getErrorEmoji(error.level);
    let message = `${emoji} ${error.message}`;

    // 添加建议
    const suggestion = this.getSuggestion(error.type);
    if (suggestion) {
      message += `\n\n💡 建议: ${suggestion}`;
    }

    return message;
  }

  /**
   * 获取错误 emoji
   */
  private static getErrorEmoji(level: ErrorLevel): string {
    switch (level) {
      case ErrorLevel.FATAL: return '❌';
      case ErrorLevel.ERROR: return '⚠️ ';
      case ErrorLevel.WARN: return '⚠️ ';
      case ErrorLevel.INFO: return 'ℹ️ ';
      default: return '🔴';
    }
  }

  /**
   * 获取错误建议
   */
  private static getSuggestion(type: ErrorType): string | null {
    switch (type) {
      case ErrorType.API_AUTH:
        return '请检查 API 密钥是否正确，使用: cline config set api.apiKey <your-key>';
      case ErrorType.API_RATE_LIMIT:
        return '请稍后重试，或升级您的 API 计划';
      case ErrorType.CONFIG_MISSING:
        return '请先配置必需项，使用: cline config set <key> <value>';
      case ErrorType.FILE_NOT_FOUND:
        return '请检查文件路径是否正确';
      case ErrorType.FILE_PERMISSION:
        return '请检查文件权限，或使用管理员权限运行';
      case ErrorType.SECURITY_ERROR:
        return '此操作被安全策略阻止，请检查路径或命令';
      case ErrorType.COMMAND_NOT_FOUND:
        return '请确保命令已安装并在 PATH 中';
      default:
        return null;
    }
  }

  /**
   * 记录错误到文件
   */
  static async logError(error: StructuredError): Promise<void> {
    if (!this.enableLogging) return;

    try {
      await fs.mkdir(this.logDir, { recursive: true });
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `error-${date}.log`);
      
      const logEntry = [
        `[${new Date(error.timestamp).toISOString()}]`,
        `[${error.level}]`,
        `[${error.type}]`,
        error.message,
        error.details ? `Details: ${JSON.stringify(error.details)}` : '',
        error.context ? `Context: ${JSON.stringify(error.context)}` : '',
        error.stack ? `Stack: ${error.stack}` : '',
        '---',
      ].filter(Boolean).join(' ');
      
      await fs.appendFile(logFile, logEntry + '\n', 'utf8');
    } catch (logError) {
      // 静默失败，不影响主流程
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * 处理错误（统一入口）
   */
  static async handleError(
    error: any,
    context?: Record<string, any>
  ): Promise<StructuredError> {
    const structured = this.createStructuredError(error, context);
    await this.logError(structured);
    return structured;
  }

  /**
   * 启用/禁用日志
   */
  static setLogging(enabled: boolean): void {
    this.enableLogging = enabled;
  }

  /**
   * 设置日志目录
   */
  static setLogDirectory(dir: string): void {
    this.logDir = dir;
  }
}

/**
 * 快捷函数：处理并格式化错误
 */
export async function handleAndFormatError(
  error: any,
  context?: Record<string, any>
): Promise<string> {
  const structured = await ErrorHandler.handleError(error, context);
  return ErrorHandler.formatErrorForUser(structured);
}
