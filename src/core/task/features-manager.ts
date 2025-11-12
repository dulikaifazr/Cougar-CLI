/**
 * 功能管理器
 * 统一管理所有高级功能的初始化、启用/禁用和生命周期
 * 
 * 基于官方 task/index.ts 的功能组织方式适配
 */

import { DEFAULT_ADVANCED_FEATURES_CONFIG, AdvancedFeaturesConfig, mergeConfig } from '../../config/advanced-features';
import { FocusChainManager } from './focus-chain';
import { ContextOptimizer, OptimizationResult } from '../context/optimizer';
import { ContextPriorityManager } from '../context/priority-manager';
import { CheckpointBranchManager } from '../checkpoints/branch-manager';
import { ToolUsageTracker, getGlobalTracker } from '../tools/usage-tracker';
import { ParallelToolExecutor } from '../tools/parallel-executor';
import { TaskState } from './state';
import { TaskStateExtensions } from './state-extensions';
import { AdvancedTaskConfig, AdvancedFeatureManagers, InitializationOptions, FeatureStats, FeatureStatus } from './advanced-config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * 高级功能管理器
 */
export class FeaturesManager {
  private config: AdvancedFeaturesConfig;
  private managers: AdvancedFeatureManagers;
  private taskId: string;
  private cwd: string;
  private taskState: TaskState;
  private initialized: boolean = false;

  constructor(options: InitializationOptions) {
    this.taskId = options.taskId;
    this.cwd = options.cwd;
    this.taskState = options.taskState;
    
    // 合并配置
    this.config = options.features 
      ? mergeConfig(DEFAULT_ADVANCED_FEATURES_CONFIG, options.features)
      : DEFAULT_ADVANCED_FEATURES_CONFIG;
    
    this.managers = {};
  }

  /**
   * 初始化所有功能
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('⚠️  FeaturesManager 已经初始化');
      return;
    }

    console.log('\n🚀 初始化高级功能...');

    try {
      // 1. 初始化 Focus Chain
      if (this.config.focusChain.enabled) {
        this.managers.focusChain = new FocusChainManager(
          this.taskId,
          this.taskState,
          this.config.focusChain
        );
        console.log('   ✓ Focus Chain 已启用');
      }

      // 2. 初始化优先级管理器
      if (this.config.priorityManagement.enabled) {
        this.managers.priorityManager = new ContextPriorityManager();
        console.log('   ✓ 优先级管理器已启用');
      }

      // 3. 初始化分支管理器
      if (this.config.branchManagement.enabled) {
        this.managers.branchManager = new CheckpointBranchManager(this.cwd);
        console.log('   ✓ 分支管理器已启用');
      }

      // 4. 初始化工具追踪器
      if (this.config.toolTracking.enabled) {
        this.managers.toolTracker = getGlobalTracker(this.taskId);
        await this.managers.toolTracker.loadStats();
        console.log('   ✓ 工具追踪器已启用');
      }

      this.initialized = true;
      console.log('\n✓ 高级功能初始化完成\n');
    } catch (error) {
      console.error('❌ 高级功能初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置
   */
  getConfig(): AdvancedFeaturesConfig {
    return this.config;
  }

  /**
   * 获取管理器
   */
  getManagers(): AdvancedFeatureManagers {
    return this.managers;
  }

  /**
   * 应用智能压缩
   */
  applySmartCompression(
    messages: Anthropic.MessageParam[],
    startFromIndex?: number
  ): OptimizationResult | null {
    if (!this.config.smartCompression.enabled) {
      return null;
    }

    const result = ContextOptimizer.applyOptimizations(
      messages,
      startFromIndex || this.config.smartCompression.startFromIndex
    );

    if (this.config.smartCompression.showReport && result.optimized) {
      console.log(ContextOptimizer.generateReport(result));
    }

    return result;
  }

  /**
   * 检查是否应该跳过截断
   */
  shouldSkipTruncation(optimizationResult: OptimizationResult): boolean {
    if (!this.config.smartCompression.enabled) {
      return false;
    }

    return ContextOptimizer.shouldSkipTruncation(
      optimizationResult,
      this.config.smartCompression.threshold
    );
  }

  /**
   * 生成 Focus Chain 指令
   */
  generateFocusChainInstructions(mode: 'plan' | 'act' = 'act'): string | null {
    if (!this.config.focusChain.enabled || !this.managers.focusChain) {
      return null;
    }

    if (!this.managers.focusChain.shouldIncludeFocusChainInstructions(mode)) {
      return null;
    }

    return this.managers.focusChain.generateFocusChainInstructions(mode);
  }

  /**
   * 更新 Focus Chain
   */
  async updateFocusChain(taskProgress: string | undefined): Promise<void> {
    if (!this.config.focusChain.enabled || !this.managers.focusChain) {
      return;
    }

    await this.managers.focusChain.updateFocusChainFromToolResponse(taskProgress);
  }

  /**
   * 检查完成时的未完成项
   */
  checkIncompleteProgress(): void {
    if (!this.config.focusChain.enabled || !this.managers.focusChain) {
      return;
    }

    this.managers.focusChain.checkIncompleteProgressOnCompletion();
  }

  /**
   * 记录工具执行
   */
  trackToolExecution(toolName: string, success: boolean, duration: number): void {
    if (!this.config.toolTracking.enabled || !this.managers.toolTracker) {
      return;
    }

    this.managers.toolTracker.trackToolExecution(toolName, success, duration);

    // 检查是否需要显示报告
    const stats = this.managers.toolTracker.getAllStats();
    const totalExecutions = stats.reduce((sum, s) => sum + s.totalCalls, 0);
    
    if (this.config.toolTracking.showReport && 
        totalExecutions > 0 && 
        totalExecutions % this.config.toolTracking.reportInterval === 0) {
      this.managers.toolTracker.printReport();
    }
  }

  /**
   * 检查是否应该创建自动检查点
   */
  shouldCreateAutoCheckpoint(trigger: 'first_request' | 'file_edit' | 'command_exec' | 'user_feedback'): boolean {
    if (!this.config.autoCheckpoint.enabled) {
      return false;
    }

    switch (trigger) {
      case 'first_request':
        return this.config.autoCheckpoint.onFirstRequest;
      case 'file_edit':
        return this.config.autoCheckpoint.onFileEdit;
      case 'command_exec':
        return this.config.autoCheckpoint.onCommandExec;
      case 'user_feedback':
        return this.config.autoCheckpoint.onUserFeedback;
      default:
        return false;
    }
  }

  /**
   * 获取功能统计
   */
  getFeatureStats(): FeatureStats {
    const stats: FeatureStats = {};

    // Focus Chain 统计
    if (this.managers.focusChain) {
      const fcStats = this.managers.focusChain.getCurrentStats();
      stats.focusChain = {
        enabled: this.config.focusChain.enabled,
        currentList: this.taskState.currentFocusChainChecklist,
        totalItems: fcStats?.totalItems || 0,
        completedItems: fcStats?.completedItems || 0,
      };
    }

    // 优先级管理统计
    if (this.managers.priorityManager) {
      const pmStats = this.managers.priorityManager.getPriorityStats();
      stats.priorityManagement = {
        enabled: this.config.priorityManagement.enabled,
        protectedMessages: this.managers.priorityManager.getProtectedMessages().length,
        criticalMessages: pmStats.critical,
      };
    }

    // 工具追踪统计
    if (this.managers.toolTracker) {
      const report = this.managers.toolTracker.generateUsageReport();
      stats.toolTracking = {
        enabled: this.config.toolTracking.enabled,
        totalExecutions: report.totalExecutions,
        successRate: report.totalExecutions > 0 
          ? report.mostUsedTools.reduce((sum, t) => sum + t.successRate, 0) / report.mostUsedTools.length 
          : 0,
      };
    }

    return stats;
  }

  /**
   * 获取功能状态
   */
  getFeatureStatus(): FeatureStatus[] {
    return [
      {
        name: 'Focus Chain',
        enabled: this.config.focusChain.enabled,
        initialized: !!this.managers.focusChain,
      },
      {
        name: 'Smart Compression',
        enabled: this.config.smartCompression.enabled,
        initialized: true,
      },
      {
        name: 'Priority Management',
        enabled: this.config.priorityManagement.enabled,
        initialized: !!this.managers.priorityManager,
      },
      {
        name: 'Auto Checkpoint',
        enabled: this.config.autoCheckpoint.enabled,
        initialized: true,
      },
      {
        name: 'Branch Management',
        enabled: this.config.branchManagement.enabled,
        initialized: !!this.managers.branchManager,
      },
      {
        name: 'Tool Tracking',
        enabled: this.config.toolTracking.enabled,
        initialized: !!this.managers.toolTracker,
      },
      {
        name: 'Parallel Execution',
        enabled: this.config.parallelExecution.enabled,
        initialized: true,
      },
    ];
  }

  /**
   * 打印功能状态
   */
  printFeatureStatus(): void {
    const status = this.getFeatureStatus();
    
    console.log('\n📊 高级功能状态');
    console.log('='.repeat(50));
    
    for (const feature of status) {
      const icon = feature.enabled ? '✓' : '✗';
      // 只有启用的功能才显示初始化状态
      if (feature.enabled) {
        const initIcon = feature.initialized ? '🟢' : '🔴';
        console.log(`${icon} ${feature.name}: 启用 ${initIcon}`);
      } else {
        console.log(`${icon} ${feature.name}: 禁用`);
      }
    }
    
    console.log('='.repeat(50));
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // 保存工具统计
    if (this.managers.toolTracker && this.config.toolTracking.saveToFile) {
      await this.managers.toolTracker.saveStats();
    }

    // 清理 Focus Chain
    if (this.managers.focusChain) {
      this.managers.focusChain.dispose();
    }

    console.log('\n✓ 高级功能已清理');
  }
}

/**
 * 创建功能管理器
 */
export function createFeaturesManager(options: InitializationOptions): FeaturesManager {
  return new FeaturesManager(options);
}
