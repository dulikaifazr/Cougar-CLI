/**
 * 🆕 CLI 专用：任务元数据管理
 * 负责读写任务元数据到磁盘
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TaskMetadata } from './types';
import { fileExists } from '../../utils/fs';

/**
 * 获取任务元数据文件路径
 */
export function getTaskMetadataPath(sessionId: string): string {
  return path.join(
    os.homedir(),
    '.cougar',
    'sessions',
    sessionId,
    'task-metadata.json'
  );
}

/**
 * 读取任务元数据
 */
export async function getTaskMetadata(sessionId: string): Promise<TaskMetadata> {
  const metadataPath = getTaskMetadataPath(sessionId);

  if (await fileExists(metadataPath)) {
    try {
      const data = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Failed to read task metadata: ${error}`);
    }
  }

  // 返回默认空元数据
  return {
    files: {},
    models: [],
  };
}

/**
 * 保存任务元数据
 */
export async function saveTaskMetadata(
  sessionId: string,
  metadata: TaskMetadata
): Promise<void> {
  const metadataPath = getTaskMetadataPath(sessionId);

  try {
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to save task metadata: ${error}`);
  }
}

/**
 * 清除任务元数据
 */
export async function clearTaskMetadata(sessionId: string): Promise<void> {
  const metadataPath = getTaskMetadataPath(sessionId);

  try {
    if (await fileExists(metadataPath)) {
      await fs.unlink(metadataPath);
    }
  } catch (error) {
    console.error(`Failed to clear task metadata: ${error}`);
  }
}
