/**
 * 🔧 焦点链工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/焦点链工具定义.ts
 * 
 * 作用：焦点链功能的工具定义（多文件编辑）
 * 
 * 用途：支持任务进度追踪和多文件编辑工作流
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, type ClineToolSpec } from './types';

// 临时方案：作为工具依赖项的占位符
const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id: ClineDefaultTool.FOCUS_CHAIN,
  name: 'focus_chain',
  description: 'Manage focus chain for multi-file editing workflow and task progress tracking',
  parameters: [],
};

const nextGen = { ...generic, variant: ModelFamily.NEXT_GEN };
const gpt = { ...generic, variant: ModelFamily.GPT };
const gemini = { ...generic, variant: ModelFamily.GEMINI };

export const focus_chain_variants = [generic, nextGen, gpt, gemini];