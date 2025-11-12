/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/模板引擎/占位符定义.ts
 * 
 * 核心作用：定义系统提示词的所有可用部分（占位符）
 * 
 * 主要内容：
 * - SystemPromptSection 枚举：定义12个标准提示词部分
 * - STANDARD_PLACEHOLDERS：所有标准占位符列表
 * - REQUIRED_PLACEHOLDERS：必需的占位符
 */

/**
 * 系统提示词的各个部分（占位符）
 * 这些占位符将在模板中使用，格式为 {{SECTION_NAME}}
 */
export enum SystemPromptSection {
  // 核心身份和能力
  AGENT_ROLE = 'AGENT_ROLE',                      // Agent 角色定义
  CAPABILITIES = 'CAPABILITIES',                  // Agent 能力说明
  
  // 工具和操作
  TOOL_USE = 'TOOL_USE',                         // 工具使用说明
  EDITING_FILES = 'EDITING_FILES',               // 文件编辑指南
  
  // 任务管理
  OBJECTIVE = 'OBJECTIVE',                       // 任务目标
  TASK_PROGRESS = 'TASK_PROGRESS',               // 任务进度追踪
  TODO = 'TODO',                                 // 待办事项管理
  
  // 模式和规则
  ACT_VS_PLAN = 'ACT_VS_PLAN',                  // 行动模式 vs 计划模式
  RULES = 'RULES',                               // 行为规则和约束
  
  // 集成和反馈
  MCP = 'MCP',                                   // MCP 服务器集成
  FEEDBACK = 'FEEDBACK',                         // 用户反馈和帮助
  
  // 上下文信息
  SYSTEM_INFO = 'SYSTEM_INFO',                   // 系统信息（OS、目录等）
  USER_INSTRUCTIONS = 'USER_INSTRUCTIONS',       // 用户自定义指令
}

/**
 * 标准占位符定义
 * 包含所有系统信息和提示词部分的占位符
 */
export const STANDARD_PLACEHOLDERS = {
  // 系统信息
  OS: 'OS',
  SHELL: 'SHELL',
  HOME_DIR: 'HOME_DIR',
  WORKING_DIR: 'WORKING_DIR',
  
  // MCP 服务器
  MCP_SERVERS_LIST: 'MCP_SERVERS_LIST',
  
  // 上下文变量
  CWD: 'CWD',
  SUPPORTS_BROWSER: 'SUPPORTS_BROWSER',
  MODEL_FAMILY: 'MODEL_FAMILY',
  
  // 动态内容
  CURRENT_DATE: 'CURRENT_DATE',
  
  // 系统提示词部分
  ...SystemPromptSection,
} as const;

export type StandardPlaceholder = (typeof STANDARD_PLACEHOLDERS)[keyof typeof STANDARD_PLACEHOLDERS];

/**
 * 必需的占位符
 * 这些占位符必须在每个提示词变体中存在
 */
export const REQUIRED_PLACEHOLDERS: StandardPlaceholder[] = [
  STANDARD_PLACEHOLDERS.AGENT_ROLE,
  STANDARD_PLACEHOLDERS.SYSTEM_INFO,
];

/**
 * 检查占位符是否为标准占位符
 */
export function isStandardPlaceholder(placeholder: string): boolean {
  return Object.values(STANDARD_PLACEHOLDERS).includes(placeholder as any);
}

/**
 * 检查占位符是否为必需占位符
 */
export function isRequiredPlaceholder(placeholder: string): boolean {
  return REQUIRED_PLACEHOLDERS.includes(placeholder as any);
}

/**
 * 验证必需的占位符是否都存在
 * @param placeholders - 占位符映射对象
 * @returns 缺失的必需占位符列表
 */
export function validateRequiredPlaceholders(placeholders: Record<string, any>): string[] {
  const missing: string[] = [];
  
  for (const required of REQUIRED_PLACEHOLDERS) {
    if (!placeholders[required]) {
      missing.push(required);
    }
  }
  
  return missing;
}
