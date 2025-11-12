/**
 * 🔄 90% 复用自原系统
 * 来源: 提示词/系统提示词/提示词注册表/提示词注册和管理.ts
 * 
 * 核心作用：提示词系统的中央管理器，单例模式
 * 
 * CLI 适配：
 * - 移除 VSCode 相关的模型家族检测
 * - 简化为只支持 GENERIC 变体
 * - 移除复杂的标签/版本查询
 */

import { ModelFamily } from '../types';
import { registerClineToolSets } from '../tools/init';
import type { ComponentFunction, ComponentRegistry, PromptVariant, SystemPromptContext } from '../types';
import { loadAllVariantConfigs } from '../variants';
import { config as genericConfig } from '../variants/generic/config';
import { PromptBuilder } from './builder';
import { COMPONENT_REGISTRY } from '../components';

export class PromptRegistry {
  private static instance: PromptRegistry;
  private variants: Map<string, PromptVariant> = new Map();
  private components: ComponentRegistry = {};
  private loaded: boolean = false;

  private constructor() {
    registerClineToolSets();
  }

  static getInstance(): PromptRegistry {
    if (!PromptRegistry.instance) {
      PromptRegistry.instance = new PromptRegistry();
    }
    return PromptRegistry.instance;
  }

  /**
   * 在初始化时加载所有提示词和组件
   */
  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    // loadVariants 是同步的，只有 loadComponents 是异步的
    this.loadVariants();
    await this.loadComponents();

    // 执行健康检查以确保关键变体可用
    this.performHealthCheck();

    this.loaded = true;
  }

  /**
   * 执行健康检查以确保注册表处于有效状态
   */
  private performHealthCheck(): void {
    const criticalVariants = [ModelFamily.GENERIC];
    const missingVariants = criticalVariants.filter((variant) => !this.variants.has(variant));

    if (missingVariants.length > 0) {
      console.error(`Registry health check failed: Missing critical variants: ${missingVariants.join(', ')}`);
      console.error(`Available variants: ${Array.from(this.variants.keys()).join(', ')}`);
    }

    if (this.variants.size === 0) {
      console.error('Registry health check failed: No variants loaded at all');
    }

    if (Object.keys(this.components).length === 0) {
      console.warn('Registry health check warning: No components loaded');
    }

    console.log(
      `Registry health check: ${this.variants.size} variants, ${Object.keys(this.components).length} components loaded`
    );
  }

  /**
   * 根据上下文获取提示词，回退到通用提示词
   */
  async get(context: SystemPromptContext): Promise<string> {
    await this.load();

    // CLI 版本直接使用 GENERIC 变体
    let variant = this.variants.get(ModelFamily.GENERIC);

    if (!variant) {
      // 带调试信息的增强错误
      const availableVariants = Array.from(this.variants.keys());
      const errorDetails = {
        availableVariants,
        variantsCount: this.variants.size,
        componentsCount: Object.keys(this.components).length,
        isLoaded: this.loaded,
      };

      console.error('Prompt variant lookup failed:', errorDetails);

      throw new Error(
        `No generic prompt variant found. ` +
          `Available variants: [${availableVariants.join(', ')}]. ` +
          `Registry state: loaded=${this.loaded}, variants=${this.variants.size}, components=${
            Object.keys(this.components).length
          }`
      );
    }

    const builder = new PromptBuilder(variant, context, this.components);
    return await builder.build();
  }

  /**
   * 注册组件函数
   */
  registerComponent(id: string, componentFn: ComponentFunction): void {
    this.components[id] = componentFn;
  }

  /**
   * 获取可用模型 ID 列表
   */
  getAvailableModels(): string[] {
    const models = new Set<string>();
    for (const variant of this.variants.values()) {
      models.add(variant.id);
    }
    return Array.from(models);
  }

  /**
   * 获取变体元数据
   */
  getVariantMetadata(modelId: string): PromptVariant | undefined {
    return this.variants.get(modelId);
  }

  /**
   * 从变体目录加载所有变体
   */
  private loadVariants(): void {
    try {
      this.variants = new Map<string, PromptVariant>();

      for (const [id, config] of Object.entries(loadAllVariantConfigs())) {
        this.variants.set(id, { ...config, id });
      }

      // 确保通用变体始终可用作安全回退
      this.ensureGenericFallback();
    } catch (error) {
      console.warn('Warning: Could not load variants:', error);
      // 即使变体加载完全失败，也创建最小的通用回退
      this.createMinimalGenericFallback();
    }
  }

  /**
   * 确保通用变体可用，如果缺少则创建最小的变体
   */
  private ensureGenericFallback(): void {
    if (!this.variants.has(ModelFamily.GENERIC)) {
      console.warn('Generic variant not found, creating minimal fallback');
      this.createMinimalGenericFallback();
    }
  }

  /**
   * 创建最小的通用变体作为绝对回退
   */
  private createMinimalGenericFallback(): void {
    this.loadVariantFromConfig(ModelFamily.GENERIC, genericConfig);
  }

  /**
   * 从其 TypeScript 配置加载单个变体
   */
  private loadVariantFromConfig(variantId: string, config: Omit<PromptVariant, 'id'>): void {
    try {
      const variant: PromptVariant = {
        ...config,
        id: variantId,
      };

      this.variants.set(variantId, variant);

      // 如果指定，还使用版本后缀注册
      if (variant.version > 1) {
        this.variants.set(`${variantId}@${variant.version}`, variant);
      }
    } catch (error) {
      console.warn(`Warning: Could not load variant '${variantId}':`, error);
    }
  }

  /**
   * 从组件目录加载所有组件
   */
  private async loadComponents(): Promise<void> {
    try {
      // 直接使用已注册的组件
      this.components = { ...COMPONENT_REGISTRY };
    } catch (error) {
      console.warn('Warning: Could not load some components:', error);
    }
  }

  public static dispose(): void {
    PromptRegistry.instance = null as unknown as PromptRegistry;
  }
}
