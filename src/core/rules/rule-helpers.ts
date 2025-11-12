/**
 * 🔄 90% 复用自原系统
 * 来源: 上下文/用户指令/规则管理辅助函数.ts
 * 
 * 核心作用： 提供所有规则文件管理的基础工具函数
 * 主要改动：移除 Controller 依赖
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { CougarRulesToggles } from './types';
import { fileExists, isDirectory, readDirectory } from '../../utils/fs';

/**
 * 🔄 100% 复用：递归遍历目录并查找所有文件
 */
export async function readDirectoryRecursive(
  directoryPath: string,
  allowedFileExtension: string,
  excludedPaths: string[][] = []
): Promise<string[]> {
  try {
    const entries = await readDirectory(directoryPath, excludedPaths);
    const results: string[] = [];

    for (const entry of entries) {
      if (allowedFileExtension !== '') {
        const fileExtension = path.extname(entry);
        if (fileExtension !== allowedFileExtension) {
          continue;
        }
      }
      results.push(entry);
    }

    return results;
  } catch (error) {
    console.error(`Error reading directory ${directoryPath}: ${error}`);
    return [];
  }
}

/**
 * 🔄 100% 复用：同步规则开关状态
 */
export async function synchronizeRuleToggles(
  rulesDirectoryPath: string,
  currentToggles: CougarRulesToggles,
  allowedFileExtension: string = '',
  excludedPaths: string[][] = []
): Promise<CougarRulesToggles> {
  const updatedToggles = { ...currentToggles };

  try {
    const pathExists = await fileExists(rulesDirectoryPath);

    if (pathExists) {
      const isDir = await isDirectory(rulesDirectoryPath);

      if (isDir) {
        // 目录情况
        const filePaths = await readDirectoryRecursive(
          rulesDirectoryPath,
          allowedFileExtension,
          excludedPaths
        );
        const existingRulePaths = new Set<string>();

        for (const filePath of filePaths) {
          const ruleFilePath = path.resolve(rulesDirectoryPath, filePath);
          existingRulePaths.add(ruleFilePath);

          const pathHasToggle = ruleFilePath in updatedToggles;
          if (!pathHasToggle) {
            updatedToggles[ruleFilePath] = true;
          }
        }

        // 清理不存在文件的开关
        for (const togglePath in updatedToggles) {
          const pathExists = existingRulePaths.has(togglePath);
          if (!pathExists) {
            delete updatedToggles[togglePath];
          }
        }
      } else {
        // 文件情况
        const pathHasToggle = rulesDirectoryPath in updatedToggles;
        if (!pathHasToggle) {
          updatedToggles[rulesDirectoryPath] = true;
        }

        // 删除其他路径的开关
        for (const togglePath in updatedToggles) {
          if (togglePath !== rulesDirectoryPath) {
            delete updatedToggles[togglePath];
          }
        }
      }
    } else {
      // 路径不存在，清除所有开关
      for (const togglePath in updatedToggles) {
        delete updatedToggles[togglePath];
      }
    }
  } catch (error) {
    console.error(`Failed to synchronize rule toggles for path: ${rulesDirectoryPath}`, error);
  }

  return updatedToggles;
}

/**
 * 🔄 100% 复用：读取规则文件的内容
 */
export async function getRuleFilesTotalContent(
  rulesFilePaths: string[],
  basePath: string,
  toggles: CougarRulesToggles
): Promise<string> {
  const ruleFilesTotalContent = await Promise.all(
    rulesFilePaths.map(async (filePath) => {
      const ruleFilePath = path.resolve(basePath, filePath);
      const ruleFilePathRelative = path.relative(basePath, ruleFilePath);

      if (ruleFilePath in toggles && toggles[ruleFilePath] === false) {
        return null;
      }

      const content = await fs.readFile(ruleFilePath, 'utf8');
      return `${ruleFilePathRelative}\n${content.trim()}`;
    })
  ).then((contents) => contents.filter(Boolean).join('\n\n'));

  return ruleFilesTotalContent;
}

/**
 * 🆕 确保全局规则目录存在（官方标准路径）
 */
export async function ensureRulesDirectoryExists(): Promise<string> {
  // 获取用户文档目录
  const documentsPath = await getDocumentsPath();
  const rulesPath = path.join(documentsPath, 'Cougar', 'Rules');
  
  try {
    await fs.mkdir(rulesPath, { recursive: true });
  } catch (_error) {
    // 如果创建失败，回退到 homedir/Documents/Cougar/Rules
    const fallbackPath = path.join(os.homedir(), 'Documents', 'Cougar', 'Rules');
    await fs.mkdir(fallbackPath, { recursive: true });
    return fallbackPath;
  }
  
  return rulesPath;
}

/**
 * 获取用户文档目录
 */
async function getDocumentsPath(): Promise<string> {
  if (process.platform === 'win32') {
    try {
      // 在 Windows 上使用 PowerShell 获取文档路径
      const { execSync } = await import('child_process');
      const result = execSync(
        'powershell -NoProfile -Command "[System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)"',
        { encoding: 'utf8' }
      );
      const trimmedPath = result.trim();
      if (trimmedPath) {
        return trimmedPath;
      }
    } catch (_err) {
      console.error('Failed to retrieve Windows Documents path. Falling back to homedir/Documents.');
    }
  }
  
  // 默认回退到 homedir/Documents
  return path.join(os.homedir(), 'Documents');
}

/**
 * 🆕 确保全局工作流目录存在（官方标准路径）
 */
export async function ensureWorkflowsDirectoryExists(): Promise<string> {
  // 获取用户文档目录
  const documentsPath = await getDocumentsPath();
  const workflowsPath = path.join(documentsPath, 'Cougar', 'Workflows');
  
  try {
    await fs.mkdir(workflowsPath, { recursive: true });
  } catch (_error) {
    // 如果创建失败，回退到 homedir/Documents/Cougar/Workflows
    const fallbackPath = path.join(os.homedir(), 'Documents', 'Cougar', 'Workflows');
    await fs.mkdir(fallbackPath, { recursive: true });
    return fallbackPath;
  }
  
  return workflowsPath;
}