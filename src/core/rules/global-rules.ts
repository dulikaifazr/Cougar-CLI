/**
 * 🔄 70% 覆用自原系统
 * 来源: 上下文/用户指令/Cougar 规则.ts
 * 
 * 核心作用：管理全局 Cougar 规则
 * 主要改动：適配 CLI 路径（~/.cougar/rules）
 */
import path from 'path';
import os from 'os';
import { CougarRulesToggles } from './types';
import { getRuleFilesTotalContent, ensureRulesDirectoryExists } from './rule-helpers';
import { fileExists, isDirectory, readDirectory } from '../../utils/fs';

/**
 * 🔄 適配 CLI：获取全局 Cougar 规则
 */
export async function getGlobalCougarRules(
  toggles: CougarRulesToggles
): Promise<string | undefined> {
  const globalCougarRulesFilePath = await ensureRulesDirectoryExists();

  if (await fileExists(globalCougarRulesFilePath)) {
    if (await isDirectory(globalCougarRulesFilePath)) {
      try {
        const rulesFilePaths = await readDirectory(globalCougarRulesFilePath);
        const rulesFilesTotalContent = await getRuleFilesTotalContent(
          rulesFilePaths,
          globalCougarRulesFilePath,
          toggles
        );

        if (rulesFilesTotalContent) {
          return `# Global Cougar Rules (from ${globalCougarRulesFilePath})\n\n${rulesFilesTotalContent}`;
        }
      } catch (error) {
        console.error(`Failed to read .cougarrules directory at ${globalCougarRulesFilePath}`);
      }
    }
  }

  return undefined;
}