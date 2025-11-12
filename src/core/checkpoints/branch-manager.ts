/**
 * 检查点分支管理器
 * 新功能：扩展现有检查点系统，支持分支和标签
 * 
 * 核心功能：
 * - 创建检查点分支
 * - 切换分支
 * - 合并分支
 * - 标签管理
 * 
 * 使用场景：
 * - 实验性修改：创建分支尝试不同方案
 * - 版本管理：为重要检查点打标签
 * - 并行开发：在不同分支上进行不同任务
 */

import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import { getShadowGitPath, hashWorkingDir } from './CheckpointUtils';

/**
 * 分支信息
 */
export interface BranchInfo {
  name: string;
  current: boolean;
  lastCommit: string;
  lastCommitMessage: string;
  createdAt: Date;
}

/**
 * 标签信息
 */
export interface TagInfo {
  name: string;
  hash: string;
  message: string;
  createdAt: Date;
}

/**
 * 合并结果
 */
export interface MergeResult {
  success: boolean;
  conflicts: string[];
  message: string;
}

/**
 * 检查点分支管理器
 */
export class CheckpointBranchManager {
  private cwd: string;
  private git: SimpleGit | null = null;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  /**
   * 初始化 Git 实例
   */
  private async getGit(): Promise<SimpleGit> {
    if (!this.git) {
      const cwdHash = hashWorkingDir(this.cwd);
      const gitPath = await getShadowGitPath(cwdHash);
      this.git = simpleGit(path.dirname(gitPath));
    }
    return this.git;
  }

  /**
   * 创建分支
   * @param name 分支名称
   * @param fromHash 可选：从指定提交创建分支
   * @returns 新分支的 commit hash
   */
  async createBranch(name: string, fromHash?: string): Promise<string> {
    const git = await this.getGit();

    try {
      // 检查分支是否已存在
      const branches = await git.branch();
      if (branches.all.includes(name)) {
        throw new Error(`分支 '${name}' 已存在`);
      }

      if (fromHash) {
        // 从指定提交创建分支
        await git.checkoutBranch(name, fromHash);
      } else {
        // 从当前位置创建分支
        await git.checkoutLocalBranch(name);
      }

      const currentHash = await git.revparse(['HEAD']);
      console.log(`✓ 已创建分支: ${name} (${currentHash.substring(0, 8)})`);
      return currentHash;
    } catch (error: any) {
      throw new Error(`创建分支失败: ${error.message}`);
    }
  }

  /**
   * 切换分支
   * @param name 分支名称
   */
  async switchBranch(name: string): Promise<void> {
    const git = await this.getGit();

    try {
      // 检查分支是否存在
      const branches = await git.branch();
      if (!branches.all.includes(name)) {
        throw new Error(`分支 '${name}' 不存在`);
      }

      await git.checkout(name);
      console.log(`✓ 已切换到分支: ${name}`);
    } catch (error: any) {
      throw new Error(`切换分支失败: ${error.message}`);
    }
  }

  /**
   * 列出所有分支
   * @returns 分支信息数组
   */
  async listBranches(): Promise<BranchInfo[]> {
    const git = await this.getGit();

    try {
      const branchSummary = await git.branch();
      const branches: BranchInfo[] = [];

      for (const branchName of branchSummary.all) {
        const isCurrent = branchName === branchSummary.current;
        const log = await git.log({ maxCount: 1, branch: branchName } as any);
        const lastCommit = log.latest;

        if (lastCommit) {
          branches.push({
            name: branchName,
            current: isCurrent,
            lastCommit: lastCommit.hash,
            lastCommitMessage: lastCommit.message,
            createdAt: new Date(lastCommit.date),
          });
        }
      }

      return branches;
    } catch (error: any) {
      throw new Error(`列出分支失败: ${error.message}`);
    }
  }

  /**
   * 获取当前分支名称
   * @returns 当前分支名称
   */
  async getCurrentBranch(): Promise<string> {
    const git = await this.getGit();

    try {
      const branchSummary = await git.branch();
      return branchSummary.current;
    } catch (error: any) {
      throw new Error(`获取当前分支失败: ${error.message}`);
    }
  }

  /**
   * 删除分支
   * @param name 分支名称
   * @param force 是否强制删除
   */
  async deleteBranch(name: string, force: boolean = false): Promise<void> {
    const git = await this.getGit();

    try {
      // 不能删除当前分支
      const currentBranch = await this.getCurrentBranch();
      if (currentBranch === name) {
        throw new Error('不能删除当前分支，请先切换到其他分支');
      }

      await git.deleteLocalBranch(name, force);
      console.log(`✓ 已删除分支: ${name}`);
    } catch (error: any) {
      throw new Error(`删除分支失败: ${error.message}`);
    }
  }

  /**
   * 合并分支
   * @param sourceBranch 源分支名称
   * @param targetBranch 目标分支名称（默认为当前分支）
   * @returns 合并结果
   */
  async mergeBranch(sourceBranch: string, targetBranch?: string): Promise<MergeResult> {
    const git = await this.getGit();

    try {
      // 如果指定了目标分支，先切换到目标分支
      if (targetBranch) {
        await this.switchBranch(targetBranch);
      }

      const currentBranch = await this.getCurrentBranch();

      // 执行合并
      const mergeResult = await git.merge([sourceBranch]);

      // 检查是否有冲突
      const status = await git.status();
      const conflicts = status.conflicted;

      if (conflicts.length > 0) {
        return {
          success: false,
          conflicts,
          message: `合并失败：存在 ${conflicts.length} 个冲突文件`,
        };
      }

      console.log(`✓ 已将 ${sourceBranch} 合并到 ${currentBranch}`);
      return {
        success: true,
        conflicts: [],
        message: `成功合并 ${sourceBranch} 到 ${currentBranch}`,
      };
    } catch (error: any) {
      return {
        success: false,
        conflicts: [],
        message: `合并失败: ${error.message}`,
      };
    }
  }

  /**
   * 添加标签
   * @param hash 提交 hash
   * @param tagName 标签名称
   * @param message 可选：标签消息
   */
  async addTag(hash: string, tagName: string, message?: string): Promise<void> {
    const git = await this.getGit();

    try {
      // 检查标签是否已存在
      const tags = await git.tags();
      if (tags.all.includes(tagName)) {
        throw new Error(`标签 '${tagName}' 已存在`);
      }

      if (message) {
        // 创建带注释的标签
        await git.addAnnotatedTag(tagName, message);
      } else {
        // 创建轻量级标签
        await git.addTag(tagName);
      }

      console.log(`✓ 已添加标签: ${tagName} -> ${hash.substring(0, 8)}`);
    } catch (error: any) {
      throw new Error(`添加标签失败: ${error.message}`);
    }
  }

  /**
   * 删除标签
   * @param tagName 标签名称
   */
  async deleteTag(tagName: string): Promise<void> {
    const git = await this.getGit();

    try {
      await git.tag(['-d', tagName]);
      console.log(`✓ 已删除标签: ${tagName}`);
    } catch (error: any) {
      throw new Error(`删除标签失败: ${error.message}`);
    }
  }

  /**
   * 列出所有标签
   * @returns 标签信息数组
   */
  async listTags(): Promise<TagInfo[]> {
    const git = await this.getGit();

    try {
      const tags = await git.tags();
      const tagInfos: TagInfo[] = [];

      for (const tagName of tags.all) {
        try {
          // 获取标签指向的提交
          const hash = await git.revparse([tagName]);
          
          // 尝试获取标签消息（如果是带注释的标签）
          let message = '';
          try {
            const tagInfo = await git.show(['-s', '--format=%B', tagName]);
            message = tagInfo.trim();
          } catch {
            // 轻量级标签没有消息
            message = '(lightweight tag)';
          }

          // 获取提交日期
          const log = await git.log({ maxCount: 1, from: hash, to: hash } as any);
          const commit = log.latest;

          if (commit) {
            tagInfos.push({
              name: tagName,
              hash: hash,
              message: message,
              createdAt: new Date(commit.date),
            });
          }
        } catch (error) {
          console.warn(`警告：无法获取标签 ${tagName} 的信息`);
        }
      }

      return tagInfos;
    } catch (error: any) {
      throw new Error(`列出标签失败: ${error.message}`);
    }
  }

  /**
   * 根据标签恢复
   * @param tagName 标签名称
   */
  async restoreFromTag(tagName: string): Promise<void> {
    const git = await this.getGit();

    try {
      // 检查标签是否存在
      const tags = await git.tags();
      if (!tags.all.includes(tagName)) {
        throw new Error(`标签 '${tagName}' 不存在`);
      }

      // 获取标签指向的提交
      const hash = await git.revparse([tagName]);
      
      // 恢复到该提交
      await git.checkout(hash);
      console.log(`✓ 已恢复到标签: ${tagName} (${hash.substring(0, 8)})`);
    } catch (error: any) {
      throw new Error(`从标签恢复失败: ${error.message}`);
    }
  }

  /**
   * 比较两个分支的差异
   * @param branch1 分支1
   * @param branch2 分支2
   * @returns 差异文件列表
   */
  async compareBranches(branch1: string, branch2: string): Promise<string[]> {
    const git = await this.getGit();

    try {
      const diff = await git.diff([`${branch1}...${branch2}`, '--name-only']);
      return diff.split('\n').filter(line => line.trim().length > 0);
    } catch (error: any) {
      throw new Error(`比较分支失败: ${error.message}`);
    }
  }

  /**
   * 获取分支的提交历史
   * @param branchName 分支名称
   * @param limit 限制数量
   * @returns 提交历史
   */
  async getBranchHistory(branchName: string, limit: number = 10): Promise<any[]> {
    const git = await this.getGit();

    try {
      const log = await git.log({ maxCount: limit, branch: branchName } as any);
      return [...log.all]; // 使用扩展运算符创建新数组，解决 readonly 问题
    } catch (error: any) {
      throw new Error(`获取分支历史失败: ${error.message}`);
    }
  }
}

/**
 * 创建分支管理器实例
 * @param cwd 工作目录
 * @returns CheckpointBranchManager 实例
 */
export function createBranchManager(cwd?: string): CheckpointBranchManager {
  return new CheckpointBranchManager(cwd || process.cwd());
}
