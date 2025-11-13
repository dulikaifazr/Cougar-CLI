/**
 * 🆕 CLI 专用：对话历史存储
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileExists } from '../../utils/fs';
import { MessageParam } from '../context/types';

export class HistoryStorage {
  private historyPath: string;

  constructor(sessionId: string) {
    this.historyPath = path.join(
      os.homedir(),
      '.cougar',
      'sessions',
      sessionId,
      'history.json'
    );
  }

  /**
   * 保存完整对话历史
   */
  async save(messages: MessageParam[]): Promise<void> {
    await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
    await fs.writeFile(this.historyPath, JSON.stringify(messages, null, 2));
  }

  /**
   * 加载对话历史
   */
  async load(): Promise<MessageParam[]> {
    if (await fileExists(this.historyPath)) {
      const data = await fs.readFile(this.historyPath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  }

  /**
   * 追加单条消息
   */
  async append(message: MessageParam): Promise<void> {
    const messages = await this.load();
    messages.push(message);
    await this.save(messages);
  }

  /**
   * 清空历史
   */
  async clear(): Promise<void> {
    await this.save([]);
  }
}
