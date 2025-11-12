/**
 * 列出代码定义名称工具处理器
 * 适配自 task/工具处理器/17种工具处理器/了解代码文件中存在的函数和类名.ts
 * 
 * 功能：
 * - 分析源代码文件，提取所有顶层定义
 * - 函数和方法名称
 * - 类和接口名称
 * - 变量和常量声明
 * 
 * CLI 适配：
 * - 使用正则表达式代替 Tree-sitter
 * - 支持常见语言（JS/TS/Python/Java等）
 * - 简化实现
 */

import path from 'path';
import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as fileOps from '../utils/file-operations';
import * as formatter from '../utils/response-formatter';

/**
 * 列出代码定义名称工具处理器类
 */
export class ListCodeDefinitionsHandler implements IToolHandler {
  readonly name = 'list_code_definition_names';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行列出代码定义名称工具
   * 
   * 工作流程：
   * 1. 验证必需参数（文件路径）
   * 2. 检查路径安全性
   * 3. 解析绝对路径
   * 4. 处理批准流程
   * 5. 读取文件内容
   * 6. 解析代码定义
   * 7. 返回定义列表
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const relPath: string | undefined = params.path;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { path: relPath },
      partial: false,
    };

    const pathValidation = this.validator.assertRequiredParams(block, 'path');
    if (!pathValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'path');
    }

    // 2. 检查路径安全性
    const safetyCheck = this.validator.checkPath(relPath!);
    if (!safetyCheck.ok) {
      return formatter.toolError(safetyCheck.error);
    }

    // 参数验证通过，重置错误计数器
    config.taskState.consecutiveMistakeCount = 0;

    // 3. 解析绝对路径
    const absolutePath = path.isAbsolute(relPath!)
      ? relPath!
      : path.resolve(config.cwd, relPath!);

    // 4. 处理批准流程
    const shouldAutoApprove = config.callbacks.shouldAutoApproveTool?.(this.name) ?? false;
    
    if (!shouldAutoApprove) {
      // 请求用户批准
      await config.callbacks.say(
        'tool' as any,
        `请求分析代码定义: ${relPath}`,
      );

      const result = await config.callbacks.ask(
        'tool' as any,
        `允许分析文件 ${relPath} 吗？`,
      );

      if (result.response !== 'yesButtonClicked' as any) {
        return formatter.toolDenied();
      }
    }

    // 5. 读取文件内容
    try {
      // 检查文件是否存在
      if (!fileOps.fileExists(absolutePath)) {
        return formatter.fileNotFound(absolutePath);
      }

      // 读取文件
      const content = await fileOps.readFile(absolutePath);

      // 6. 解析代码定义
      const definitions = this.parseDefinitions(content, absolutePath);

      // 7. 返回定义列表
      if (definitions.length === 0) {
        return `No code definitions found in ${relPath}.`;
      }

      let resultText = `Found ${definitions.length} definition${definitions.length > 1 ? 's' : ''} in ${relPath}:\n\n`;
      resultText += definitions.map(def => `- ${def.type}: ${def.name}`).join('\n');
      return resultText;
    } catch (error: any) {
      return formatter.fileReadError(absolutePath, error.message);
    }
  }

  /**
   * 解析代码定义
   * 使用正则表达式提取函数、类、接口等定义
   */
  private parseDefinitions(
    content: string,
    filePath: string
  ): Array<{ type: string; name: string }> {
    const definitions: Array<{ type: string; name: string }> = [];
    const ext = path.extname(filePath).toLowerCase();

    // 根据文件类型选择不同的解析策略
    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      this.parseJavaScriptTypeScript(content, definitions);
    } else if (ext === '.py') {
      this.parsePython(content, definitions);
    } else if (ext === '.java') {
      this.parseJava(content, definitions);
    } else if (ext === '.go') {
      this.parseGo(content, definitions);
    } else if (ext === '.rs') {
      this.parseRust(content, definitions);
    } else {
      // 其他语言，尝试通用解析
      this.parseGeneric(content, definitions);
    }

    return definitions;
  }

  /**
   * 解析 JavaScript/TypeScript
   */
  private parseJavaScriptTypeScript(
    content: string,
    definitions: Array<{ type: string; name: string }>
  ): void {
    // 类声明
    const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      definitions.push({ type: 'class', name: match[1] });
    }

    // 接口声明
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/g;
    while ((match = interfaceRegex.exec(content)) !== null) {
      definitions.push({ type: 'interface', name: match[1] });
    }

    // 类型别名
    const typeRegex = /(?:export\s+)?type\s+(\w+)/g;
    while ((match = typeRegex.exec(content)) !== null) {
      definitions.push({ type: 'type', name: match[1] });
    }

    // 函数声明
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
    while ((match = functionRegex.exec(content)) !== null) {
      definitions.push({ type: 'function', name: match[1] });
    }

    // 箭头函数
    const arrowFunctionRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      definitions.push({ type: 'function', name: match[1] });
    }

    // 枚举
    const enumRegex = /(?:export\s+)?enum\s+(\w+)/g;
    while ((match = enumRegex.exec(content)) !== null) {
      definitions.push({ type: 'enum', name: match[1] });
    }
  }

  /**
   * 解析 Python
   */
  private parsePython(
    content: string,
    definitions: Array<{ type: string; name: string }>
  ): void {
    // 类声明
    const classRegex = /^class\s+(\w+)/gm;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      definitions.push({ type: 'class', name: match[1] });
    }

    // 函数声明
    const functionRegex = /^def\s+(\w+)/gm;
    while ((match = functionRegex.exec(content)) !== null) {
      definitions.push({ type: 'function', name: match[1] });
    }
  }

  /**
   * 解析 Java
   */
  private parseJava(
    content: string,
    definitions: Array<{ type: string; name: string }>
  ): void {
    // 类声明
    const classRegex = /(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      definitions.push({ type: 'class', name: match[1] });
    }

    // 接口声明
    const interfaceRegex = /(?:public\s+)?interface\s+(\w+)/g;
    while ((match = interfaceRegex.exec(content)) !== null) {
      definitions.push({ type: 'interface', name: match[1] });
    }

    // 方法声明
    const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+)\s+(\w+)\s*\(/g;
    while ((match = methodRegex.exec(content)) !== null) {
      definitions.push({ type: 'method', name: match[1] });
    }
  }

  /**
   * 解析 Go
   */
  private parseGo(
    content: string,
    definitions: Array<{ type: string; name: string }>
  ): void {
    // 函数声明
    const functionRegex = /func\s+(\w+)/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      definitions.push({ type: 'function', name: match[1] });
    }

    // 类型声明
    const typeRegex = /type\s+(\w+)\s+(?:struct|interface)/g;
    while ((match = typeRegex.exec(content)) !== null) {
      definitions.push({ type: 'type', name: match[1] });
    }
  }

  /**
   * 解析 Rust
   */
  private parseRust(
    content: string,
    definitions: Array<{ type: string; name: string }>
  ): void {
    // 函数声明
    const functionRegex = /(?:pub\s+)?fn\s+(\w+)/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      definitions.push({ type: 'function', name: match[1] });
    }

    // 结构体声明
    const structRegex = /(?:pub\s+)?struct\s+(\w+)/g;
    while ((match = structRegex.exec(content)) !== null) {
      definitions.push({ type: 'struct', name: match[1] });
    }

    // trait 声明
    const traitRegex = /(?:pub\s+)?trait\s+(\w+)/g;
    while ((match = traitRegex.exec(content)) !== null) {
      definitions.push({ type: 'trait', name: match[1] });
    }
  }

  /**
   * 通用解析（备用）
   */
  private parseGeneric(
    content: string,
    definitions: Array<{ type: string; name: string }>
  ): void {
    // 尝试匹配通用的函数和类模式
    const functionRegex = /function\s+(\w+)/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      definitions.push({ type: 'function', name: match[1] });
    }

    const classRegex = /class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      definitions.push({ type: 'class', name: match[1] });
    }
  }
}
