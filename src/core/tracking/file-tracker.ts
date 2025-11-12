/**
 * 🔄 70% 复用自原系统
 * 来源: 上下文/上下文追踪/文件上下文追踪.ts
 * 
 * 核心作用：追踪文件变更，防止 AI 使用过期内容
 * 
 * 主要改动：
 * - 移除 chokidar 实时监听（CLI 不需要）
 * - 改用按需检测（基于 mtime 和 size）
 * - 移除 VSCode API 依赖
 */
import fs from 'fs/promises';
import path from 'path';
import { FileMetadataEntry, TaskMetadata } from './types';
import { getTaskMetadata, saveTaskMetadata } from './metadata';
import { fileExists } from '../../utils/fs';

/**
 * 🔄 适配 CLI：记录文件被读取
 * 
 * @param sessionId 会话 ID
 * @param filePath 文件绝对路径
 * @param source 来源（tool/mention/user）
 */
export async function trackFileRead(
  sessionId: string,
  filePath: string,
  source: 'tool' | 'mention' | 'user' = 'tool'
): Promise<void> {
  const metadata = await getTaskMetadata(sessionId);
  const absolutePath = path.resolve(filePath);

  try {
    // 获取文件状态
    const stats = await fs.stat(absolutePath);

    // 记录或更新文件元数据
    const entry: FileMetadataEntry = {
      path: absolutePath,
      state: 'read',
      source,
      readDate: Date.now(),
      mtime: stats.mtimeMs,
      size: stats.size,
    };

    metadata.files[absolutePath] = entry;
    await saveTaskMetadata(sessionId, metadata);
  } catch (error) {
    console.error(`Failed to track file read: ${filePath}`, error);
  }
}

/**
 * 🔄 适配 CLI：记录文件被编辑
 * 
 * @param sessionId 会话 ID
 * @param filePath 文件绝对路径
 * @param source 来源
 */
export async function trackFileEdit(
  sessionId: string,
  filePath: string,
  source: 'tool' | 'mention' | 'user' = 'tool'
): Promise<void> {
  const metadata = await getTaskMetadata(sessionId);
  const absolutePath = path.resolve(filePath);

  try {
    const stats = await fs.stat(absolutePath);

    const entry: FileMetadataEntry = {
      path: absolutePath,
      state: 'edited',
      source,
      editedDate: Date.now(),
      readDate: metadata.files[absolutePath]?.readDate,
      mtime: stats.mtimeMs,
      size: stats.size,
    };

    metadata.files[absolutePath] = entry;
    await saveTaskMetadata(sessionId, metadata);
  } catch (error) {
    console.error(`Failed to track file edit: ${filePath}`, error);
  }
}

/**
 * 🔄 适配 CLI：记录文件被创建
 */
export async function trackFileCreate(
  sessionId: string,
  filePath: string,
  source: 'tool' | 'mention' | 'user' = 'tool'
): Promise<void> {
  const metadata = await getTaskMetadata(sessionId);
  const absolutePath = path.resolve(filePath);

  try {
    const stats = await fs.stat(absolutePath);

    const entry: FileMetadataEntry = {
      path: absolutePath,
      state: 'created',
      source,
      editedDate: Date.now(),
      mtime: stats.mtimeMs,
      size: stats.size,
    };

    metadata.files[absolutePath] = entry;
    await saveTaskMetadata(sessionId, metadata);
  } catch (error) {
    console.error(`Failed to track file create: ${filePath}`, error);
  }
}

/**
 * 🆕 检测文件是否在读取后被修改
 * 
 * @param sessionId 会话 ID
 * @param filePath 文件绝对路径
 * @returns 是否已修改
 */
export async function isFileModified(
  sessionId: string,
  filePath: string
): Promise<boolean> {
  const metadata = await getTaskMetadata(sessionId);
  const absolutePath = path.resolve(filePath);
  const trackedFile = metadata.files[absolutePath];

  if (!trackedFile || !trackedFile.mtime) {
    return false;
  }

  try {
    if (!(await fileExists(absolutePath))) {
      return true; // 文件被删除
    }

    const stats = await fs.stat(absolutePath);

    // 比较 mtime 和 size
    return (
      stats.mtimeMs !== trackedFile.mtime || stats.size !== trackedFile.size
    );
  } catch (error) {
    return true; // 无法访问，视为已修改
  }
}

/**
 * 🆕 获取所有已修改的文件
 * 
 * @param sessionId 会话 ID
 * @returns 已修改的文件路径列表
 */
export async function getModifiedFiles(
  sessionId: string
): Promise<string[]> {
  const metadata = await getTaskMetadata(sessionId);
  const modifiedFiles: string[] = [];

  for (const [filePath, entry] of Object.entries(metadata.files)) {
    // 检测所有已追踪的文件（read 和 edited 状态）
    if ((entry.state === 'read' || entry.state === 'edited') && 
        (await isFileModified(sessionId, filePath))) {
      modifiedFiles.push(filePath);
    }
  }

  return modifiedFiles;
}

/**
 * 🆕 生成过期文件警告消息
 * 
 * @param sessionId 会话 ID
 * @returns 警告消息（如果有过期文件）
 */
export async function getStaleFileWarning(
  sessionId: string
): Promise<string | undefined> {
  const modifiedFiles = await getModifiedFiles(sessionId);

  if (modifiedFiles.length === 0) {
    return undefined;
  }

  const fileList = modifiedFiles
    .map((file) => `  - ${path.basename(file)}`)
    .join('\n');

  return `⚠️ WARNING: The following files have been modified since they were last read:
${fileList}

The content you have may be outdated. Consider re-reading these files before making changes.`;
}

/**
 * 🆕 清除文件追踪记录
 */
export async function clearFileTracking(sessionId: string): Promise<void> {
  const metadata = await getTaskMetadata(sessionId);
  metadata.files = {};
  await saveTaskMetadata(sessionId, metadata);
}

/**
 * 🆕 获取已追踪的文件列表
 */
export async function getTrackedFiles(
  sessionId: string
): Promise<FileMetadataEntry[]> {
  const metadata = await getTaskMetadata(sessionId);
  return Object.values(metadata.files);
}