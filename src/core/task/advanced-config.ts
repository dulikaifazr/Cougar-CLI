/**
 * TaskExecutor 高级配置
 * 整合所有新功能管理器
 */

import { AdvancedFeaturesConfig } from '../../config/advanced-features';
import { FocusChainManager } from './focus-chain';
import { ContextOptimizer } from '../context/optimizer';
import { ContextPriorityManager } from '../context/priority-manager';
import { CheckpointBranchManager } from '../checkpoints/branch-manager';
import { ToolUsageTracker } from '../tools/usage-tracker';
import { ParallelToolExecutor } from '../tools/parallel-executor';
import { TaskState } from './state';

/**
 * 高级功能管理器集合
 */
export interface AdvancedFeatureManagers {
  focusChain?: FocusChainManager;
  priorityManager?: ContextPriorityManager;
  branchManager?: CheckpointBranchManager;
  toolTracker?: ToolUsageTracker;
}

/**
 * 高级配置接口
 */
export interface AdvancedTaskConfig {
  // 功能配置
  features: AdvancedFeaturesConfig;
  
  // 功能管理器
  managers: AdvancedFeatureManagers;
  
  // 任务信息
  taskId: string;
  cwd: string;
  
  // 任务状态
  taskState: TaskState;
}

/**
 * 初始化选项
 */
export interface InitializationOptions {
  taskId: string;
  cwd: string;
  taskState: TaskState;
  features?: Partial<AdvancedFeaturesConfig>;
}

/**
 * 功能统计信息
 */
export interface FeatureStats {
  focusChain?: {
    enabled: boolean;
    currentList: string | null;
    totalItems: number;
    completedItems: number;
  };
  
  smartCompression?: {
    enabled: boolean;
    totalOptimizations: number;
    totalSavings: number;
  };
  
  priorityManagement?: {
    enabled: boolean;
    protectedMessages: number;
    criticalMessages: number;
  };
  
  autoCheckpoint?: {
    enabled: boolean;
    totalCheckpoints: number;
    lastCheckpointTime: number;
  };
  
  toolTracking?: {
    enabled: boolean;
    totalExecutions: number;
    successRate: number;
  };
  
  parallelExecution?: {
    enabled: boolean;
    totalParallelGroups: number;
    averageSpeedup: number;
  };
}

/**
 * 功能状态
 */
export interface FeatureStatus {
  name: string;
  enabled: boolean;
  initialized: boolean;
  error?: string;
}
