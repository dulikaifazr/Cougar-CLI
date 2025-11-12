/**
 * 🔄 70% 覆用自原系统
 * 来源: 上下文/用户指令/Cougar 规则.ts
 * 
 * 核心作用：管理项目本地 Cougar 规则
 */
import fs from 'fs/promises';
import path from 'path';
import { CougarRulesToggles, GlobalFileNames } from './types';
import { getRuleFilesTotalContent } from './rule-helpers';
import { fileExists, isDirectory, readDirectory } from '../../utils/fs';

/**
 * 🔄 適配 CLI：获取本地 Cougar 规则
 */
export async function getLocalCougarRules(
  cwd: string,
  toggles: CougarRulesToggles
): Promise<string | undefined> {
  const cougarRulesFilePath = path.resolve(cwd, GlobalFileNames.cougarRules);

  let cougarRulesFileInstructions: string | undefined;

  if (await fileExists(cougarRulesFilePath)) {
    if (await isDirectory(cougarRulesFilePath)) {
      try {
        const rulesFilePaths = await readDirectory(cougarRulesFilePath, [
          ['.cougarrules', 'workflows'],
        ]);

        const rulesFilesTotalContent = await getRuleFilesTotalContent(
          rulesFilePaths,
          cwd,
          toggles
        );

        if (rulesFilesTotalContent) {
          cougarRulesFileInstructions = `# Local Project Rules (from ${cwd})\n\n${rulesFilesTotalContent}`;
        }
      } catch (error) {
        console.error(`Failed to read .cougarrules directory at ${cougarRulesFilePath}`);
      }
    } else {
      // 单文件模式
      try {
        // CLI 环境：如果 toggles 为空或文件未显式禁用，则加载规则
        const shouldLoad = Object.keys(toggles).length === 0 || 
                          !(cougarRulesFilePath in toggles) || 
                          toggles[cougarRulesFilePath] !== false;
        
        if (shouldLoad) {
          const ruleFileContent = (await fs.readFile(cougarRulesFilePath, 'utf8')).trim();
          if (ruleFileContent) {
            cougarRulesFileInstructions = `# Local Project Rules (from ${cwd})\n\n${ruleFileContent}`;
          }
        }
      } catch (error) {
        console.error(`Failed to read .cougarrules file at ${cougarRulesFilePath}`);
      }
    }
  }

  return cougarRulesFileInstructions;
}