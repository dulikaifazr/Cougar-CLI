/**
 * 文件操作工具
 * 封装 Node.js fs 操作
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * 读取文件内容
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error: any) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

/**
 * 写入文件内容
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // 写入文件
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error: any) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

/**
 * 检查文件是否存在
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * 检查是否是目录
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
 * 列出目录下的文件
 */
export async function listFiles(
  dirPath: string,
  options?: {
    recursive?: boolean;
    pattern?: RegExp;
  }
): Promise<string[]> {
  const files: string[] = [];
  
  async function scan(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (options?.recursive) {
            await scan(fullPath);
          }
        } else {
          // 应用模式过滤
          if (!options?.pattern || options.pattern.test(fullPath)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }
  
  await scan(dirPath);
  return files;
}

/**
 * 搜索文件内容
 */
export async function searchInFiles(
  dirPath: string,
  searchTerm: string,
  options?: {
    filePattern?: RegExp;
    caseSensitive?: boolean;
  }
): Promise<Array<{ file: string; line: number; content: string }>> {
  const results: Array<{ file: string; line: number; content: string }> = [];
  const files = await listFiles(dirPath, { 
    recursive: true, 
    pattern: options?.filePattern 
  });
  
  const searchRegex = new RegExp(
    searchTerm,
    options?.caseSensitive ? 'g' : 'gi'
  );
  
  for (const file of files) {
    try {
      const content = await readFile(file);
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (searchRegex.test(line)) {
          results.push({
            file,
            line: index + 1,
            content: line.trim(),
          });
        }
      });
    } catch {
      // 忽略无法读取的文件
    }
  }
  
  return results;
}

/**
 * 删除文件
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * 获取文件信息
 */
export async function getFileInfo(filePath: string): Promise<{
  size: number;
  created: Date;
  modified: Date;
  isDirectory: boolean;
}> {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
    };
  } catch (error: any) {
    throw new Error(`Failed to get file info: ${error.message}`);
  }
}

/**
 * 复制文件
 */
export async function copyFile(source: string, destination: string): Promise<void> {
  try {
    await fs.copyFile(source, destination);
  } catch (error: any) {
    throw new Error(`Failed to copy file: ${error.message}`);
  }
}
