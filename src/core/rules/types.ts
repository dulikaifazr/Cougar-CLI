/**
 * 🔄 100% 复用自原系统
 * 来源: @shared/cougar-rules
 */

/**
 * 规则文件的开关状态
 * key: 文件路径（绝对路径）
 * value: 是否启用
 */
export interface CougarRulesToggles {
  [filePath: string]: boolean;
}

/**
 * 全局文件名常量
 */
export const GlobalFileNames = {
  cougarRules: '.cougarrules',
  workflows: '.cougarrules/workflows',
} as const;