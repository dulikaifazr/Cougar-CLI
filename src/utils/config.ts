/**
 * 配置文件读写工具
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CliConfig, ConfigKey, ConfigValue } from '../types/config';

// 配置文件路径：~/.cougar/config.json
const CONFIG_DIR = path.join(os.homedir(), '.cougar');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * 读取配置文件
 */
export function loadConfig(): CliConfig {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取配置文件失败:', error);
    return {};
  }
}

/**
 * 保存配置文件
 */
export function saveConfig(config: CliConfig): void {
  ensureConfigDir();
  
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('保存配置文件失败:', error);
    throw error;
  }
}

/**
 * 获取配置值（支持嵌套路径，如 'api.apiKey'）
 */
export function getConfigValue(key: ConfigKey): ConfigValue {
  const config = loadConfig();
  const keys = key.split('.');
  
  let value: any = config;
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * 设置配置值（支持嵌套路径）
 */
export function setConfigValue(key: ConfigKey, value: ConfigValue): void {
  const config = loadConfig();
  const keys = key.split('.');
  const lastKey = keys.pop()!;
  
  let current: any = config;
  for (const k of keys) {
    if (!current[k] || typeof current[k] !== 'object') {
      current[k] = {};
    }
    current = current[k];
  }
  
  current[lastKey] = value;
  saveConfig(config);
}

/**
 * 删除配置值
 */
export function deleteConfigValue(key: ConfigKey): void {
  const config = loadConfig();
  const keys = key.split('.');
  const lastKey = keys.pop()!;
  
  let current: any = config;
  for (const k of keys) {
    if (!current[k]) {
      return; // 路径不存在，无需删除
    }
    current = current[k];
  }
  
  delete current[lastKey];
  saveConfig(config);
}

/**
 * 列出所有配置（展平格式）
 */
export function listConfig(): Record<string, ConfigValue> {
  const config = loadConfig();
  const result: Record<string, ConfigValue> = {};
  
  function flatten(obj: any, prefix: string = '') {
    for (const key in obj) {
      const value = obj[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value, fullKey);
      } else {
        result[fullKey] = value;
      }
    }
  }
  
  flatten(config);
  return result;
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

