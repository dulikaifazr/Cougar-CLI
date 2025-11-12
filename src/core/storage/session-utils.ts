/**
 * 🆕 CLI 专用：会话管理工具函数
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SessionManager, SessionMetadata } from './session';
import { HistoryStorage } from './history';
import { fileExists } from '../../utils/fs';

/**
 * 获取所有会话目录
 */
export async function getAllSessions(): Promise<string[]> {
  const sessionsDir = path.join(os.homedir(), '.cline', 'sessions');
  
  if (!(await fileExists(sessionsDir))) {
    return [];
  }
  
  const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

/**
 * 获取会话详细信息
 */
export async function getSessionInfo(sessionId: string): Promise<{
  metadata: SessionMetadata | null;
  messageCount: number;
  exists: boolean;
}> {
  const sessionMgr = new SessionManager(sessionId);
  const historyStorage = new HistoryStorage(sessionId);
  
  const sessionPath = sessionMgr.getSessionPath();
  const exists = await fileExists(sessionPath);
  
  if (!exists) {
    return { metadata: null, messageCount: 0, exists: false };
  }
  
  const metadata = await sessionMgr.loadMetadata();
  const history = await historyStorage.load();
  
  return {
    metadata,
    messageCount: history.length,
    exists: true,
  };
}

/**
 * 删除会话
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const sessionMgr = new SessionManager(sessionId);
  const sessionPath = sessionMgr.getSessionPath();
  
  if (!(await fileExists(sessionPath))) {
    return false;
  }
  
  await fs.rm(sessionPath, { recursive: true, force: true });
  return true;
}

/**
 * 清空会话历史
 */
export async function clearSessionHistory(sessionId: string): Promise<boolean> {
  const sessionMgr = new SessionManager(sessionId);
  const historyStorage = new HistoryStorage(sessionId);
  const sessionPath = sessionMgr.getSessionPath();
  
  if (!(await fileExists(sessionPath))) {
    return false;
  }
  
  // 清空历史
  await historyStorage.clear();
  
  // 重置元数据
  const metadata = await sessionMgr.loadMetadata();
  if (metadata) {
    metadata.messageCount = 0;
    metadata.totalTokens = 0;
    metadata.lastActiveAt = Date.now();
    await sessionMgr.saveMetadata(metadata);
  }
  
  return true;
}

/**
 * 导出会话为 JSON
 */
export async function exportSession(sessionId: string): Promise<string | null> {
  const info = await getSessionInfo(sessionId);
  
  if (!info.exists) {
    return null;
  }
  
  const historyStorage = new HistoryStorage(sessionId);
  const history = await historyStorage.load();
  
  const exportData = {
    sessionId,
    metadata: info.metadata,
    history,
    exportedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 获取会话文件大小
 */
export async function getSessionSize(sessionId: string): Promise<number> {
  const sessionMgr = new SessionManager(sessionId);
  const sessionPath = sessionMgr.getSessionPath();
  
  if (!(await fileExists(sessionPath))) {
    return 0;
  }
  
  let totalSize = 0;
  const files = await fs.readdir(sessionPath);
  
  for (const file of files) {
    const filePath = path.join(sessionPath, file);
    const stats = await fs.stat(filePath);
    totalSize += stats.size;
  }
  
  return totalSize;
}

/**
 * 格式化字节大小
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}