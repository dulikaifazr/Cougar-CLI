/**
 * 高级功能配置
 * 定义所有新功能的开关和参数
 * 
 * 功能列表：
 * - Focus Chain: 任务规划系统
 * - Smart Compression: 智能上下文压缩
 * - Priority Management: 上下文优先级管理
 * - Auto Checkpoint: 自动检查点
 * - Branch Management: 检查点分支管理
 * - Tool Usage Tracking: 工具使用统计
 * - Parallel Execution: 并行工具执行
 */

/**
 * Focus Chain 配置
 */
export interface FocusChainConfig {
  enabled: boolean;              // 是否启用
  remindInterval: number;        // 提醒间隔（API 请求次数）
  autoCreate: boolean;           // 是否自动创建 TODO 列表
  saveToFile: boolean;           // 是否保存到文件
}

/**
 * 智能压缩配置
 */
export interface SmartCompressionConfig {
  enabled: boolean;              // 是否启用
  threshold: number;             // 节省阈值（0-1，默认 0.3 = 30%）
  startFromIndex: number;        // 从哪个消息索引开始优化
  showReport: boolean;           // 是否显示优化报告
}

/**
 * 优先级管理配置
 */
export interface PriorityManagementConfig {
  enabled: boolean;              // 是否启用
  autoProtect: boolean;          // 是否自动保护高优先级消息
  protectRecent: number;         // 保护最近的 N 条消息
  showReport: boolean;           // 是否显示优先级报告
}

/**
 * 自动检查点配置
 */
export interface AutoCheckpointConfig {
  enabled: boolean;              // 是否启用
  onFirstRequest: boolean;       // 首次请求时创建
  onFileEdit: boolean;           // 文件编辑后创建
  onCommandExec: boolean;        // 命令执行后创建
  onUserFeedback: boolean;       // 用户反馈后创建
  interval: number;              // 自动检查点间隔（分钟）
}

/**
 * 分支管理配置
 */
export interface BranchManagementConfig {
  enabled: boolean;              // 是否启用
  autoTag: boolean;              // 是否自动打标签
  tagPrefix: string;             // 标签前缀
}

/**
 * 工具统计配置
 */
export interface ToolTrackingConfig {
  enabled: boolean;              // 是否启用
  saveToFile: boolean;           // 是否保存到文件
  showReport: boolean;           // 是否显示统计报告
  reportInterval: number;        // 报告间隔（工具执行次数）
}

/**
 * 并行执行配置
 */
export interface ParallelExecutionConfig {
  enabled: boolean;              // 是否启用
  maxParallel: number;           // 最大并行数
  showStats: boolean;            // 是否显示统计信息
  safeMode: boolean;             // 安全模式（更保守的依赖分析）
}

/**
 * 高级功能总配置
 */
export interface AdvancedFeaturesConfig {
  focusChain: FocusChainConfig;
  smartCompression: SmartCompressionConfig;
  priorityManagement: PriorityManagementConfig;
  autoCheckpoint: AutoCheckpointConfig;
  branchManagement: BranchManagementConfig;
  toolTracking: ToolTrackingConfig;
  parallelExecution: ParallelExecutionConfig;
}

/**
 * 默认配置
 */
export const DEFAULT_ADVANCED_FEATURES_CONFIG: AdvancedFeaturesConfig = {
  // Focus Chain - 默认启用
  focusChain: {
    enabled: true,
    remindInterval: 5,
    autoCreate: true,
    saveToFile: true,
  },

  // 智能压缩 - 默认启用
  smartCompression: {
    enabled: true,
    threshold: 0.3,
    startFromIndex: 2,
    showReport: false,
  },

  // 优先级管理 - 默认启用
  priorityManagement: {
    enabled: true,
    autoProtect: true,
    protectRecent: 5,
    showReport: false,
  },

  // 自动检查点 - 默认启用
  autoCheckpoint: {
    enabled: true,
    onFirstRequest: true,
    onFileEdit: true,
    onCommandExec: false,
    onUserFeedback: true,
    interval: 10,
  },

  // 分支管理 - 默认禁用（高级功能）
  branchManagement: {
    enabled: false,
    autoTag: false,
    tagPrefix: 'checkpoint-',
  },

  // 工具统计 - 默认启用
  toolTracking: {
    enabled: true,
    saveToFile: true,
    showReport: false,
    reportInterval: 20,
  },

  // 并行执行 - 默认禁用（实验性功能）
  parallelExecution: {
    enabled: false,
    maxParallel: 3,
    showStats: true,
    safeMode: true,
  },
};

/**
 * 功能预设
 */
export const FEATURE_PRESETS = {
  // 最小配置：只启用核心功能
  minimal: {
    ...DEFAULT_ADVANCED_FEATURES_CONFIG,
    focusChain: { ...DEFAULT_ADVANCED_FEATURES_CONFIG.focusChain, enabled: false },
    smartCompression: { ...DEFAULT_ADVANCED_FEATURES_CONFIG.smartCompression, enabled: true },
    priorityManagement: { ...DEFAULT_ADVANCED_FEATURES_CONFIG.priorityManagement, enabled: false },
    autoCheckpoint: { ...DEFAULT_ADVANCED_FEATURES_CONFIG.autoCheckpoint, enabled: true },
    toolTracking: { ...DEFAULT_ADVANCED_FEATURES_CONFIG.toolTracking, enabled: false },
  } as AdvancedFeaturesConfig,

  // 推荐配置：平衡性能和功能
  recommended: DEFAULT_ADVANCED_FEATURES_CONFIG,

  // 全功能：启用所有功能
  full: {
    focusChain: { enabled: true, remindInterval: 5, autoCreate: true, saveToFile: true },
    smartCompression: { enabled: true, threshold: 0.3, startFromIndex: 2, showReport: true },
    priorityManagement: { enabled: true, autoProtect: true, protectRecent: 5, showReport: true },
    autoCheckpoint: { enabled: true, onFirstRequest: true, onFileEdit: true, onCommandExec: true, onUserFeedback: true, interval: 10 },
    branchManagement: { enabled: true, autoTag: true, tagPrefix: 'checkpoint-' },
    toolTracking: { enabled: true, saveToFile: true, showReport: true, reportInterval: 20 },
    parallelExecution: { enabled: true, maxParallel: 3, showStats: true, safeMode: true },
  } as AdvancedFeaturesConfig,

  // 性能优先：禁用所有功能
  performance: {
    focusChain: { enabled: false, remindInterval: 5, autoCreate: false, saveToFile: false },
    smartCompression: { enabled: false, threshold: 0.3, startFromIndex: 2, showReport: false },
    priorityManagement: { enabled: false, autoProtect: false, protectRecent: 0, showReport: false },
    autoCheckpoint: { enabled: false, onFirstRequest: false, onFileEdit: false, onCommandExec: false, onUserFeedback: false, interval: 0 },
    branchManagement: { enabled: false, autoTag: false, tagPrefix: '' },
    toolTracking: { enabled: false, saveToFile: false, showReport: false, reportInterval: 0 },
    parallelExecution: { enabled: false, maxParallel: 1, showStats: false, safeMode: true },
  } as AdvancedFeaturesConfig,
};

/**
 * 预设类型
 */
export type FeaturePreset = keyof typeof FEATURE_PRESETS;

/**
 * 获取预设配置
 */
export function getPresetConfig(preset: FeaturePreset): AdvancedFeaturesConfig {
  return FEATURE_PRESETS[preset];
}

/**
 * 合并配置
 */
export function mergeConfig(
  base: AdvancedFeaturesConfig,
  override: Partial<AdvancedFeaturesConfig>
): AdvancedFeaturesConfig {
  return {
    focusChain: { ...base.focusChain, ...override.focusChain },
    smartCompression: { ...base.smartCompression, ...override.smartCompression },
    priorityManagement: { ...base.priorityManagement, ...override.priorityManagement },
    autoCheckpoint: { ...base.autoCheckpoint, ...override.autoCheckpoint },
    branchManagement: { ...base.branchManagement, ...override.branchManagement },
    toolTracking: { ...base.toolTracking, ...override.toolTracking },
    parallelExecution: { ...base.parallelExecution, ...override.parallelExecution },
  };
}
