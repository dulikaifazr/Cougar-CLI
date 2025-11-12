/**
 * 工具验证器
 * 适配自 task/工具处理器/工具验证器.ts
 * 
 * 核心作用：
 * - 在工具执行前验证参数和访问权限
 * - 防止访问被禁止的文件
 * - 提供明确的错误信息
 * 
 * CLI 适配：
 * - 简化 .clineignore 检查（CLI 版本可能不需要）
 * - 保留核心验证逻辑
 */

import { ToolUse, ToolParamName } from '../assistant-message';

/**
 * 验证结果类型
 */
export type ValidationResult = 
  | { ok: true } 
  | { ok: false; error: string };

/**
 * 工具验证器类
 * 轻量级验证器，由所有工具处理器使用
 */
export class ToolValidator {
  /**
   * 验证工具块上是否存在必需参数
   * 
   * @param block - 工具使用块
   * @param params - 必需的参数名称列表
   * @returns 验证结果
   */
  assertRequiredParams(block: ToolUse, ...params: ToolParamName[]): ValidationResult {
    for (const p of params) {
      // params 存储在 block.params 中使用它们的标签名称
      const val = block.params[p];
      if (val === undefined || val === null || String(val).trim() === '') {
        return { 
          ok: false, 
          error: `Missing required parameter '${p}' for tool '${block.name}'.` 
        };
      }
    }
    return { ok: true };
  }

  /**
   * 验证路径是否合法 - 增强版
   * 更全面的安全检查
   * 
   * @param relPath - 相对路径
   * @returns 验证结果
   */
  checkPath(relPath: string): ValidationResult {
    if (!relPath || relPath.trim() === '') {
      return { ok: false, error: 'Path cannot be empty.' };
    }

    const normalized = relPath.replace(/\\/g, '/');
    const dangerous = [
      { p: /\.\.[\\\/]/, d: 'parent directory traversal' },
      { p: /^\/etc[\\\/]/, d: 'system directory' },
      { p: /^\/sys[\\\/]/, d: 'system directory' },
      { p: /^\/proc[\\\/]/, d: 'system directory' },
      { p: /^\/dev[\\\/]/, d: 'device directory' },
      { p: /^\/root[\\\/]/, d: 'root directory' },
      { p: /^C:\\Windows\\/i, d: 'Windows system' },
      { p: /\/\.ssh[\\\/]/, d: 'SSH config' },
      { p: /\/\.aws[\\\/]/, d: 'AWS credentials' },
      { p: /\/\.env/, d: 'environment file' },
      { p: /id_rsa|id_dsa/, d: 'SSH key' },
      { p: /password|secret|token/i, d: 'sensitive file' },
    ];

    for (const { p, d } of dangerous) {
      if (p.test(normalized)) {
        return { ok: false, error: `Access denied: ${d}` };
      }
    }
    return { ok: true };
  }

  /**
   * 验证命令是否安全 - 增强版
   * 更全面的命令检查
   * 
   * @param command - 要执行的命令
   * @returns 验证结果
   */
  checkCommand(command: string): ValidationResult {
    if (!command || command.trim() === '') {
      return { ok: false, error: 'Command cannot be empty.' };
    }

    const lower = command.toLowerCase();
    const dangerous = [
      { p: /rm\s+-rf\s+\//, d: 'delete from root' },
      { p: /rm\s+-rf\s+\*/, d: 'delete all' },
      { p: /mkfs/, d: 'format filesystem' },
      { p: /dd\s+if=/, d: 'disk operation' },
      { p: /:[(][)]/, d: 'fork bomb' },
      { p: /chmod\s+-R\s+777/, d: 'dangerous permissions' },
      { p: /curl.*\|.*sh/, d: 'pipe to shell' },
      { p: /wget.*\|.*sh/, d: 'pipe to shell' },
      { p: /shutdown|reboot/, d: 'system control' },
      { p: /passwd/, d: 'password change' },
      { p: /useradd|userdel/, d: 'user management' },
    ];

    for (const { p, d } of dangerous) {
      if (p.test(lower)) {
        return { ok: false, error: `Dangerous command: ${d}` };
      }
    }
    return { ok: true };
  }
}
