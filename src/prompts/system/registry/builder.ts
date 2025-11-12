/**
 * 🔄 90% 复用自原系统
 * 来源: 提示词/系统提示词/提示词注册表/提示词构建器.ts
 * 
 * 核心作用：编排所有组件、工具和占位符，构建最终的系统提示词
 * 
 * CLI 适配：
 * - 移除 VSCode 相关的工具类型
 * - 简化 getModelFamily 逻辑
 * - 使用字符串数组代替工具枚举
 */

import { ClineToolSet } from '../tools/toolset';
import type { ClineToolSpec } from '../tools/types';
import { STANDARD_PLACEHOLDERS } from '../template/placeholders';
import { TemplateEngine } from '../template/engine';
import type { ComponentRegistry, PromptVariant, SystemPromptContext } from '../types';
import { ModelFamily } from '../types';

// 预定义的标准占位符映射，避免运行时创建对象
const STANDARD_PLACEHOLDER_KEYS = Object.values(STANDARD_PLACEHOLDERS);

export class PromptBuilder {
  private templateEngine: TemplateEngine;

  constructor(
    private variant: PromptVariant,
    private context: SystemPromptContext,
    private components: ComponentRegistry
  ) {
    this.templateEngine = new TemplateEngine();
  }

  async build(): Promise<string> {
    const componentSections = await this.buildComponents();
    const placeholderValues = this.preparePlaceholders(componentSections);
    const prompt = this.templateEngine.resolve(this.variant.baseTemplate, placeholderValues);
    return this.postProcess(prompt);
  }

  private async buildComponents(): Promise<Record<string, string>> {
    const sections: Record<string, string> = {};
    const { componentOrder } = this.variant;

    // 按顺序处理组件以保持顺序
    for (const componentId of componentOrder) {
      const componentFn = this.components[componentId];
      if (!componentFn) {
        console.warn(`Warning: Component '${componentId}' not found`);
        continue;
      }

      try {
        const result = await componentFn(this.context);
        if (result?.trim()) {
          sections[componentId] = result;
        }
      } catch (error) {
        console.warn(`Warning: Failed to build component '${componentId}':`, error);
      }
    }

    return sections;
  }

  private preparePlaceholders(componentSections: Record<string, string>): Record<string, unknown> {
    // 创建具有最佳容量的基础占位符对象
    const placeholders: Record<string, unknown> = {};

    // 添加变体占位符
    Object.assign(placeholders, this.variant.placeholders);

    // 添加标准系统占位符
    placeholders[STANDARD_PLACEHOLDERS.CWD] = this.context.cwd || process.cwd();
    placeholders[STANDARD_PLACEHOLDERS.SUPPORTS_BROWSER] = false; // CLI 不支持浏览器
    placeholders[STANDARD_PLACEHOLDERS.MODEL_FAMILY] = this.variant.family;
    placeholders[STANDARD_PLACEHOLDERS.CURRENT_DATE] = new Date().toISOString().split('T')[0];

    // 添加所有组件部分
    Object.assign(placeholders, componentSections);

    // 在单个循环中将组件部分映射到标准占位符
    for (const key of STANDARD_PLACEHOLDER_KEYS) {
      if (!placeholders[key]) {
        placeholders[key] = componentSections[key] || '';
      }
    }

    // 添加具有最高优先级的运行时占位符
    const runtimePlaceholders = (this.context as any).runtimePlaceholders;
    if (runtimePlaceholders) {
      Object.assign(placeholders, runtimePlaceholders);
    }
    return placeholders;
  }

  private postProcess(prompt: string): string {
    if (!prompt) {
      return '';
    }

    // 组合多个正则表达式操作以获得更好的性能
    return prompt
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 删除多个连续的空行
      .trim() // 删除前导/尾随空白
      .replace(/====+\s*$/, '') // 修剪后删除尾随的 ====
      .replace(/\n====+\s*\n+\s*====+\n/g, '\n====\n') // 删除分隔符之间的空部分
      .replace(/====+\n(?!\n)([^\n])/g, (match, nextChar, offset, string) => {
        // 如果后面没有换行符，则在 ====+ 后添加额外的换行符
        const beforeContext = string.substring(Math.max(0, offset - 50), offset);
        const afterContext = string.substring(offset, Math.min(string.length, offset + 50));
        const isDiffLike = /SEARCH|REPLACE|\+\+\+\+\+\+\+|-------/.test(beforeContext + afterContext);
        return isDiffLike ? match : match.replace(/\n/, '\n\n');
      })
      .replace(/([^\n])\n(?!\n)====+/g, (match, prevChar, offset, string) => {
        // 如果前面没有换行符，则在 ====+ 前添加额外的换行符
        const beforeContext = string.substring(Math.max(0, offset - 50), offset);
        const afterContext = string.substring(offset, Math.min(string.length, offset + 50));
        const isDiffLike = /SEARCH|REPLACE|\+\+\+\+\+\+\+|-------/.test(beforeContext + afterContext);
        return isDiffLike ? match : prevChar + '\n\n' + match.substring(1).replace(/\n/, '');
      });
  }

  getBuildMetadata(): {
    variantId: string;
    version: number;
    componentsUsed: string[];
    placeholdersResolved: string[];
  } {
    return {
      variantId: this.variant.id,
      version: this.variant.version,
      componentsUsed: Array.from(this.variant.componentOrder),
      placeholdersResolved: this.templateEngine.extractPlaceholders(this.variant.baseTemplate),
    };
  }

  public static async getToolsPrompts(variant: PromptVariant, context: SystemPromptContext) {
    let resolvedTools: ReturnType<typeof ClineToolSet.getTools> = [];

    // 如果变体明确列出了工具，则按 ID 解析每个工具，回退到 GENERIC
    if (variant?.tools?.length) {
      const requestedIds = [...variant.tools];
      resolvedTools = ClineToolSet.getToolsForVariantWithFallback(variant.family, requestedIds);

      // 保留请求的顺序
      resolvedTools = requestedIds
        .map((id) => resolvedTools.find((t) => t.config.id === id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t));
    } else {
      // 否则，使用为变体注册的所有工具，如果没有则使用通用工具
      resolvedTools = ClineToolSet.getTools(variant.family);
      // 按 ID 排序以获得稳定的顺序
      resolvedTools = resolvedTools.sort((a, b) => a.config.id.localeCompare(b.config.id));
    }

    // 根据上下文要求过滤
    const enabledTools = resolvedTools.filter(
      (tool) => !tool.config.contextRequirements || tool.config.contextRequirements(context)
    );

    const ids = enabledTools.map((tool) => tool.config.id);
    return Promise.all(enabledTools.map((tool) => PromptBuilder.tool(tool.config, ids, context)));
  }

  public static tool(config: ClineToolSpec, registry: string[], context: SystemPromptContext): string {
    // 跳过没有参数或描述的工具 - 这些是占位符工具
    if (!config.parameters?.length && !config.description?.length) {
      return '';
    }
    const title = `## ${config.id}`;
    const description = [`Description: ${config.description}`];

    if (!config.parameters?.length) {
      config.parameters = [];
    }

    // 克隆参数以避免修改原始参数
    const params = [...config.parameters];

    // 根据依赖关系和上下文要求过滤参数
    const filteredParams = params.filter((p) => {
      // 首先检查依赖关系（现有行为）
      if (p.dependencies?.length) {
        if (!p.dependencies.every((d) => registry.includes(d))) {
          return false;
        }
      }

      // 检查上下文要求（新行为）
      if (p.contextRequirements) {
        return p.contextRequirements(context);
      }

      return true;
    });

    // 仅从过滤后的参数收集附加描述
    const additionalDesc = filteredParams.map((p) => p.description).filter((desc): desc is string => Boolean(desc));
    if (additionalDesc.length) {
      description.push(...additionalDesc);
    }

    // 高效构建提示词部分
    const sections = [
      title,
      description.join('\n'),
      PromptBuilder.buildParametersSection(filteredParams),
      PromptBuilder.buildUsageSection(config.id, filteredParams),
    ];

    return sections.filter(Boolean).join('\n');
  }

  private static buildParametersSection(params: any[]): string {
    if (!params.length) {
      return 'Parameters: None';
    }

    const paramList = params.map((p) => {
      const requiredText = p.required ? 'required' : 'optional';
      return `- ${p.name}: (${requiredText}) ${p.instruction}`;
    });

    return ['Parameters:', ...paramList].join('\n');
  }

  private static buildUsageSection(toolId: string, params: any[]): string {
    const usageSection = ['Usage:'];
    const usageTag = `<${toolId}>`;
    const usageEndTag = `</${toolId}>`;

    usageSection.push(usageTag);

    // 添加参数使用标签
    for (const param of params) {
      const usage = param.usage || '';
      usageSection.push(`<${param.name}>${usage}</${param.name}>`);
    }

    usageSection.push(usageEndTag);
    return usageSection.join('\n');
  }
}
