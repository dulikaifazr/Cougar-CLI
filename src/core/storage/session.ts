/**
 * 🆕 CLI 专用：会话管理
 * 用于管理 CLI 对话会话的元数据
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileExists } from '../../utils/fs';

export interface SessionMetadata {
  id: string;
  createdAt: number;
  lastActiveAt: number;
  messageCount: number;
  modelId: string;
  totalTokens: number;
}

export class SessionManager {
  private sessionPath: string;
  readonly sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.sessionPath = path.join(os.homedir(), '.cline', 'sessions', sessionId);
  }

  /**
   * 初始化会话目录
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionPath, { recursive: true });
  }

  /**
   * 保存会话元数据
   */
  async saveMetadata(metadata: SessionMetadata): Promise<void> {
    const filePath = path.join(this.sessionPath, 'metadata.json');
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
  }

  /**
   * 加载会话元数据
   */
  async loadMetadata(): Promise<SessionMetadata | null> {
    const filePath = path.join(this.sessionPath, 'metadata.json');

    if (await fileExists(filePath)) {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    }

    return null;
  }

  /**
   * 获取会话目录路径
   */
  getSessionPath(): string {
    return this.sessionPath;
  }
}