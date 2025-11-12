/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/不同模型的提示词变体/变体验证器.ts
 * 
 * 核心作用：验证提示词变体配置的正确性和完整性
 * 
 * CLI 适配：100% 保留，无需修改
 */

import { STANDARD_PLACEHOLDERS, SystemPromptSection } from '../template/placeholders';
import { validateRequiredPlaceholders } from '../template/placeholders';
import { TemplateEngine } from '../template/engine';
import type { PromptVariant } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationOptions {
  strict?: boolean; // 强制执行所有最佳实践
  checkPlaceholders?: boolean; // 验证占位符使用
  checkComponents?: boolean; // 验证组件引用
  checkTools?: boolean; // 验证工具引用
}

/**
 * 提示词变体的综合验证器
 */
export class VariantValidator {
  private templateEngine = new TemplateEngine();

  /**
   * 验证完整的提示词变体
   */
  validate(variant: PromptVariant, options: ValidationOptions = {}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 默认选项
    const opts = {
      strict: false,
      checkPlaceholders: true,
      checkComponents: true,
      checkTools: true,
      ...options,
    };

    // 基本必填字段验证
    this.validateRequiredFields(variant, errors);

    // 模板验证
    if (opts.checkPlaceholders) {
      this.validateTemplate(variant, errors, warnings);
    }

    // 组件验证
    if (opts.checkComponents) {
      this.validateComponents(variant, errors, warnings);
    }

    // 工具验证
    if (opts.checkTools) {
      this.validateTools(variant, errors, warnings);
    }

    // 严格模式额外检查
    if (opts.strict) {
      this.validateBestPractices(variant, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateRequiredFields(variant: PromptVariant, errors: string[]): void {
    if (!variant.id) {
      errors.push('需要变体 ID');
    }
    if (!variant.description) {
      errors.push('需要描述');
    }
    if (!variant.baseTemplate) {
      errors.push('需要基础模板');
    }
    if (!variant.componentOrder?.length) {
      errors.push('需要组件顺序');
    }
    if (variant.version < 1) {
      errors.push('版本必须 >= 1');
    }
  }

  private validateTemplate(variant: PromptVariant, errors: string[], warnings: string[]): void {
    const { baseTemplate } = variant;

    // 从模板中提取占位符
    const templatePlaceholders = this.templateEngine.extractPlaceholders(baseTemplate);

    // 检查必需的占位符
    const missingRequired = validateRequiredPlaceholders(
      Object.fromEntries(templatePlaceholders.map((p) => [p, true]))
    );
    if (missingRequired.length > 0) {
      errors.push(`缺少必需的占位符: ${missingRequired.join(', ')}`);
    }

    // 检查未定义的占位符（不在组件顺序或标准占位符中）
    const validPlaceholders = new Set([
      ...variant.componentOrder,
      ...Object.values(STANDARD_PLACEHOLDERS),
      ...Object.keys(variant.placeholders || {}),
    ]);

    const undefinedPlaceholders = templatePlaceholders.filter((p) => !validPlaceholders.has(p));
    if (undefinedPlaceholders.length > 0) {
      warnings.push(`可能未定义的占位符: ${undefinedPlaceholders.join(', ')}`);
    }

    // 检查未使用的组件（在 componentOrder 中但不在模板中）
    const unusedComponents = variant.componentOrder.filter((c) => !templatePlaceholders.includes(c));
    if (unusedComponents.length > 0) {
      warnings.push(`已定义但未在模板中使用的组件: ${unusedComponents.join(', ')}`);
    }
  }

  private validateComponents(variant: PromptVariant, errors: string[], warnings: string[]): void {
    // 检查重复的组件
    const duplicates = this.findDuplicates([...variant.componentOrder]);
    if (duplicates.length > 0) {
      errors.push(`顺序中有重复的组件: ${duplicates.join(', ')}`);
    }

    // 检查组件覆盖是否引用有效的组件
    if (variant.componentOverrides) {
      const invalidOverrides = Object.keys(variant.componentOverrides).filter(
        (key) => !variant.componentOrder.includes(key as SystemPromptSection)
      );
      if (invalidOverrides.length > 0) {
        warnings.push(`未使用组件的组件覆盖: ${invalidOverrides.join(', ')}`);
      }
    }
  }

  private validateTools(variant: PromptVariant, errors: string[], warnings: string[]): void {
    if (!variant.tools) {
      return;
    }

    // 检查重复的工具
    const duplicates = this.findDuplicates([...variant.tools]);
    if (duplicates.length > 0) {
      errors.push(`重复的工具: ${duplicates.join(', ')}`);
    }

    // 检查工具覆盖是否引用有效的工具
    if (variant.toolOverrides) {
      const invalidOverrides = Object.keys(variant.toolOverrides).filter(
        (key) => !variant.tools?.includes(key as any)
      );
      if (invalidOverrides.length > 0) {
        warnings.push(`未使用工具的工具覆盖: ${invalidOverrides.join(', ')}`);
      }
    }
  }

  private validateBestPractices(variant: PromptVariant, warnings: string[]): void {
    // 检查推荐的组件
    const recommendedComponents = [
      SystemPromptSection.AGENT_ROLE,
      SystemPromptSection.TOOL_USE,
      SystemPromptSection.RULES,
      SystemPromptSection.SYSTEM_INFO,
    ];

    const missingRecommended = recommendedComponents.filter((c) => !variant.componentOrder.includes(c));
    if (missingRecommended.length > 0) {
      warnings.push(`缺少推荐的组件: ${missingRecommended.join(', ')}`);
    }

    // 检查正确的组件顺序
    const agentRoleIndex = variant.componentOrder.indexOf(SystemPromptSection.AGENT_ROLE);
    const toolUseIndex = variant.componentOrder.indexOf(SystemPromptSection.TOOL_USE);

    if (agentRoleIndex > 0) {
      warnings.push('AGENT_ROLE 通常应该是第一个组件');
    }

    if (toolUseIndex >= 0 && agentRoleIndex >= 0 && toolUseIndex < agentRoleIndex) {
      warnings.push('TOOL_USE 通常应该在 AGENT_ROLE 之后');
    }

    // 检查有意义的描述
    if (variant.description && variant.description.length < 20) {
      warnings.push('描述应该更详细（至少 20 个字符）');
    }

    // 检查版本标签
    if (Object.keys(variant.labels).length === 0) {
      warnings.push("考虑添加版本标签（例如：'stable'、'production'）");
    }
  }

  private findDuplicates<T>(array: T[]): T[] {
    const seen = new Set<T>();
    const duplicates = new Set<T>();

    for (const item of array) {
      if (seen.has(item)) {
        duplicates.add(item);
      }
      seen.add(item);
    }

    return Array.from(duplicates);
  }
}

/**
 * 便捷函数，用于验证变体
 */
export function validateVariant(variant: PromptVariant, options?: ValidationOptions): ValidationResult {
  const validator = new VariantValidator();
  return validator.validate(variant, options);
}

/**
 * 类型守卫，用于检查变体是否有效
 */
export function isValidVariant(variant: PromptVariant, options?: ValidationOptions): variant is PromptVariant {
  return validateVariant(variant, options).isValid;
}
