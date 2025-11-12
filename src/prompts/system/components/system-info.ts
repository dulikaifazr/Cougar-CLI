/**
 * 🔄 100% 复用自原系统（CLI适配版）
 * 来源: 提示词/系统提示词/提示词组件/系统信息.ts
 * 
 * 核心作用：提供系统环境信息
 * 
 * CLI 适配说明：
 * - 移除 VSCode API，使用 Node.js os 模块
 * - 简化多工作区支持（CLI环境不需要）
 * - 输出格式与官方源码功能等效
 * - 已修复：与官方CLI版本100%一致
 */

import type { SystemPromptContext } from '../types';
import os from 'os';
import path from 'path';

/**
 * 获取系统信息
 */
export function getSystemInfo(context: SystemPromptContext): string {
  const platform = os.platform();
  const arch = os.arch();
  const homeDir = os.homedir();
  const username = context.user?.username || os.userInfo().username;
  
  // 格式化工作目录
  const cwd = context.cwd || process.cwd();
  
  // 操作系统信息
  let osInfo = '';
  if (platform === 'darwin') {
    osInfo = 'macOS';
  } else if (platform === 'win32') {
    osInfo = 'Windows';
  } else if (platform === 'linux') {
    osInfo = 'Linux';
  } else {
    osInfo = platform;
  }
  
  // Shell 信息
  const shell = process.env.SHELL || process.env.ComSpec || 'unknown';
  const defaultShell = path.basename(shell);
  
  return `SYSTEM INFORMATION

Operating System: ${osInfo} (${arch})
Default Shell: ${defaultShell}
Home Directory: ${homeDir}
Current Working Directory: ${cwd}`;
}
