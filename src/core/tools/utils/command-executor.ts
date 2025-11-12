/**
 * 命令执行工具
 * 封装 child_process 操作
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 命令执行结果
 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

/**
 * 执行命令（简单版）
 */
export async function executeCommand(
  command: string,
  options?: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  }
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options?.cwd || process.cwd(),
      timeout: options?.timeout || 30000, // 30秒默认超时
      env: { ...process.env, ...options?.env },
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      exitCode: 0,
      success: true,
    };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message,
      exitCode: error.code || 1,
      success: false,
    };
  }
}

/**
 * 执行命令（流式版，支持实时输出）
 */
export async function executeCommandStreaming(
  command: string,
  options?: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  }
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(' ');
    
    const child = spawn(cmd, args, {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, ...options?.env },
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | null = null;

    // 设置超时
    if (options?.timeout) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
      }, options.timeout);
    }

    // 捕获标准输出
    child.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      options?.onStdout?.(text);
    });

    // 捕获错误输出
    child.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      options?.onStderr?.(text);
    });

    // 处理完成
    child.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
        success: code === 0,
      });
    });

    // 处理错误
    child.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      resolve({
        stdout,
        stderr: stderr + error.message,
        exitCode: 1,
        success: false,
      });
    });
  });
}

/**
 * 检查命令是否安全
 */
export function isCommandSafe(command: string): boolean {
  // 危险命令模式
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    /mkfs/,
    /dd\s+if=/,
    /:\(\)\{.*\|.*&\};:/,  // fork bomb
    />\s*\/dev\/sda/,
    /format\s+c:/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return false;
    }
  }

  return true;
}

/**
 * 获取当前 Shell 类型
 */
export function getShellType(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/sh';
}
