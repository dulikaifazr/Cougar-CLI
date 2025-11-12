/**
 * CLI 配置类型定义
 */

// 配置文件结构
export interface CliConfig {
  // API 配置（用于 API 通信）
  api?: {
    apiKey?: string        // API 密钥
    baseUrl?: string       // API 基础地址
    modelId?: string       // 默认模型 ID
    temperature?: number   // 温度参数 (0-1)
  }
  
  // 用户偏好
  preferences?: {
    language?: string      // 界面语言 (zh/en)
    outputFormat?: string  // 输出格式 (text/json)
  }
}

// 配置键的类型（支持嵌套访问，如 'api.apiKey'）
export type ConfigKey = string

// 配置值类型
export type ConfigValue = string | number | boolean | undefined

