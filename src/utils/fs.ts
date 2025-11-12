import fs from 'fs/promises';
import path from 'path';

/**
 * 文件大小限制（默认 100MB）
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * 大文件警告阈值（10MB）
 */
export const LARGE_FILE_WARNING_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取文件大小
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    throw new Error(`无法获取文件大小: ${error}`);
  }
}

/**
 * 检查文件大小是否在允许范围内
 */
export async function checkFileSize(
  filePath: string,
  maxSize: number = MAX_FILE_SIZE
): Promise<{ ok: boolean; size: number; isLarge: boolean }> {
  const size = await getFileSize(filePath);
  const ok = size <= maxSize;
  const isLarge = size > LARGE_FILE_WARNING_SIZE;
  return { ok, size, isLarge };
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 安全读取文件（带大小检查）
 */
export async function safeReadFile(
  filePath: string,
  options?: {
    maxSize?: number;
    encoding?: BufferEncoding;
    warnOnLarge?: boolean;
  }
): Promise<string> {
  const maxSize = options?.maxSize || MAX_FILE_SIZE;
  const encoding = options?.encoding || 'utf8';
  const warnOnLarge = options?.warnOnLarge !== false;

  // 检查文件大小
  const sizeCheck = await checkFileSize(filePath, maxSize);

  if (!sizeCheck.ok) {
    throw new Error(
      `文件过大: ${formatFileSize(sizeCheck.size)} (最大允许 ${formatFileSize(maxSize)})`
    );
  }

  if (warnOnLarge && sizeCheck.isLarge) {
    console.warn(
      `⚠️  警告: 正在读取大文件 ${path.basename(filePath)} (${formatFileSize(sizeCheck.size)})`
    );
  }

  return await fs.readFile(filePath, encoding);
}

/**
 * 批量读取文件（带并发控制）
 */
export async function batchReadFiles(
  filePaths: string[],
  options?: {
    maxConcurrent?: number;
    maxSize?: number;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<Map<string, string>> {
  const maxConcurrent = options?.maxConcurrent || 5;
  const results = new Map<string, string>();
  const queue = [...filePaths];
  let completed = 0;

  const processFile = async (filePath: string) => {
    try {
      const content = await safeReadFile(filePath, {
        maxSize: options?.maxSize,
        warnOnLarge: false, // 批量读取时不显示警告
      });
      results.set(filePath, content);
    } catch (error) {
      console.error(`读取文件失败 ${filePath}:`, error);
      results.set(filePath, `[Error: ${error}]`);
    } finally {
      completed++;
      if (options?.onProgress) {
        options.onProgress(completed, filePaths.length);
      }
    }
  };

  // 并发控制
  const workers: Promise<void>[] = [];
  for (let i = 0; i < maxConcurrent; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const filePath = queue.shift();
          if (filePath) {
            await processFile(filePath);
          }
        }
      })()
    );
  }

  await Promise.all(workers);
  return results;
}

/**
 * 检查路径是否为目录
 */
export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 递归读取目录，支持排除特定路径
 * 🔄 复用自原系统的 readDirectory 逻辑
 */
export async function readDirectory(
  directoryPath: string,
  excludedPaths: string[][] = []
): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    // 检查是否在排除列表中
    const isExcluded = excludedPaths.some(([dir, subdir]) => {
      return fullPath.includes(path.join(dir, subdir));
    });

    if (isExcluded) continue;

    if (entry.isDirectory()) {
      const subEntries = await readDirectory(fullPath, excludedPaths);
      results.push(...subEntries.map(sub => path.join(entry.name, sub)));
    } else {
      results.push(entry.name);
    }
  }

  return results;
}

/**
 * 确保目录存在，不存在则创建
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}
