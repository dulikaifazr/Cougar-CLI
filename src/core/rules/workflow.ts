/**
 * 🔄 70% 复用自原系统
 * 来源: 上下文/用户指令/工作流.ts
 * 
 * 核心作用：管理可复用的工作流模板
 */
import path from 'path';
import { CougarRulesToggles, GlobalFileNames } from './types';
import { getRuleFilesTotalContent, ensureWorkflowsDirectoryExists } from './rule-helpers';
import { fileExists, isDirectory, readDirectory } from '../../utils/fs';

/**
 * 🔄 适配 CLI：获取全局工作流
 */
export async function getGlobalWorkflows(
  toggles: CougarRulesToggles
): Promise<string | undefined> {
  const globalCougarWorkflowsFilePath = await ensureWorkflowsDirectoryExists();

  if (await fileExists(globalCougarWorkflowsFilePath)) {
    const workflowFiles = await readDirectory(globalCougarWorkflowsFilePath);
    const workflowContent = await getRuleFilesTotalContent(
      workflowFiles,
      globalCougarWorkflowsFilePath,
      toggles
    );

    if (workflowContent) {
      return `# Global Workflows\n\n${workflowContent}`;
    }
  }

  return undefined;
}

/**
 * 🔄 适配 CLI：获取本地工作流
 */
export async function getLocalWorkflows(
  cwd: string,
  toggles: CougarRulesToggles
): Promise<string | undefined> {
  const workflowsPath = path.resolve(cwd, GlobalFileNames.workflows);

  if (await fileExists(workflowsPath)) {
    if (await isDirectory(workflowsPath)) {
      const workflowFiles = await readDirectory(workflowsPath);
      const workflowContent = await getRuleFilesTotalContent(workflowFiles, cwd, toggles);

      if (workflowContent) {
        return `# Project Workflows\n\n${workflowContent}`;
      }
    }
  }

  return undefined;
}