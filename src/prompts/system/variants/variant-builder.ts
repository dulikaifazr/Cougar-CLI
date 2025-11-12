/**
 * 🔄 95% 复用自原系统
 * 来源: 提示词/系统提示词/不同模型的提示词变体/变体构建器.ts
 * 
 * 核心作用：提供类型安全的构建器，用于创建提示词变体配置
 * 
 * CLI 适配：
 * - 移除 VSCode 相关的工具类型（ClineDefaultTool）
 * - 使用字符串数组代替工具枚举
 */

import { ModelFamily } from '../types';
import { SystemPromptSection } from '../template/placeholders';
import type { ConfigOverride, PromptVariant } from '../types';

/**
 * 用于创建提示词变体的类型安全构建器
 * 提供编译时验证和 IntelliSense 支持
 */
export class VariantBuilder {
  private variant: Partial<PromptVariant> = {};

  constructor(family: ModelFamily) {
    // 初始化为干净状态
    this.variant = {
      ...this.variant,
      family: family,
      version: 1,
      tags: [],
      labels: {},
      config: {},
      componentOverrides: {},
      placeholders: {},
      toolOverrides: {},
    };
  }

  /**
   * 设置变体描述
   */
  description(desc: string): this {
    this.variant = {
      ...this.variant,
      description: desc,
    };
    return this;
  }

  /**
   * 设置版本号
   */
  version(version: number): this {
    this.variant = {
      ...this.variant,
      version: version,
    };
    return this;
  }

  /**
   * 向变体添加标签
   */
  tags(...tags: string[]): this {
    this.variant = {
      ...this.variant,
      tags: [...(this.variant.tags || []), ...tags],
    };
    return this;
  }

  /**
   * 设置带版本映射的标签
   */
  labels(labels: Record<string, number>): this {
    this.variant = {
      ...this.variant,
      labels: { ...this.variant.labels, ...labels },
    };
    return this;
  }

  /**
   * 设置基础模板（可选）
   * 如果未提供，将从 componentOrder 自动生成
   */
  template(baseTemplate: string): this {
    this.variant = {
      ...this.variant,
      baseTemplate: baseTemplate,
    };
    return this;
  }

  /**
   * 配置具有类型安全的组件顺序
   */
  components(...sections: SystemPromptSection[]): this {
    this.variant = {
      ...this.variant,
      componentOrder: sections,
    };
    return this;
  }

  /**
   * 覆盖具有类型安全的特定组件
   */
  overrideComponent(section: SystemPromptSection, override: ConfigOverride): this {
    const current = this.variant.componentOverrides || {};
    this.variant = {
      ...this.variant,
      componentOverrides: { ...current, [section]: override },
    };
    return this;
  }

  /**
   * 配置工具列表（CLI 版本使用字符串数组）
   * 如果此处列出的工具没有注册变体，则将回退到通用变体
   */
  tools(...tools: string[]): this {
    this.variant = {
      ...this.variant,
      tools: tools,
    };
    return this;
  }

  /**
   * 覆盖特定工具
   */
  overrideTool(tool: string, override: ConfigOverride): this {
    const current = this.variant.toolOverrides || {};
    this.variant = {
      ...this.variant,
      toolOverrides: { ...current, [tool]: override },
    };
    return this;
  }

  /**
   * 设置占位符值
   */
  placeholders(placeholders: Record<string, string>): this {
    this.variant = {
      ...this.variant,
      placeholders: { ...this.variant.placeholders, ...placeholders },
    };
    return this;
  }

  /**
   * 设置模型特定配置
   */
  config(config: Record<string, any>): this {
    this.variant = {
      ...this.variant,
      config: { ...this.variant.config, ...config },
    };
    return this;
  }

  /**
   * 构建最终的变体配置
   * 返回 Omit<PromptVariant, "id"> 用于变体配置文件
   */
  build(): Omit<PromptVariant, 'id'> {
    // 验证必需字段
    if (!this.variant.componentOrder?.length) {
      throw new Error('需要组件顺序');
    }
    if (!this.variant.description) {
      throw new Error('需要描述');
    }

    // 如果未提供，从 componentOrder 自动生成 baseTemplate
    const baseTemplate =
      this.variant.baseTemplate || this.generateTemplateFromComponents(this.variant.componentOrder || []);

    return {
      ...this.variant,
      baseTemplate,
    } as Omit<PromptVariant, 'id'>;
  }

  /**
   * 从组件顺序生成基础模板
   * 创建一个模板，其中每个组件的占位符由 "====" 分隔
   */
  private generateTemplateFromComponents(components: readonly SystemPromptSection[]): string {
    if (!components.length) {
      throw new Error('无法从空组件顺序生成模板');
    }

    return components
      .map((component, index) => {
        // 将枚举值转换为占位符格式
        // 例如，SystemPromptSection.AGENT_ROLE -> "{{AGENT_ROLE}}"
        const placeholder = `{{${component}}}`;

        // 在组件之间添加分隔符（最后一个除外）
        return index < components.length - 1 ? `${placeholder}\n\n====\n\n` : placeholder;
      })
      .join('');
  }
}

/**
 * 辅助函数，用于为任何模型家族创建变体构建器
 */
export const createVariant = (family: ModelFamily) => new VariantBuilder(family);
