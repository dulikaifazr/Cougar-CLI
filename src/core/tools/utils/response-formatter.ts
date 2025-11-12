/**
 * 响应格式化工具
 * 用于格式化工具执行结果
 */

/**
 * 工具错误响应
 */
export function toolError(message: string): string {
  return `Error: ${message}`;
}

/**
 * 工具拒绝响应
 */
export function toolDenied(): string {
  return 'The user denied this operation.';
}

/**
 * 缺少参数错误
 */
export function missingParameter(toolName: string, paramName: string): string {
  return `Error: Missing required parameter '${paramName}' for tool '${toolName}'.`;
}

/**
 * .clineignore 错误
 */
export function clineIgnoreError(path: string): string {
  return `Access to path '${path}' is blocked by .clineignore settings.`;
}

/**
 * 文件不存在错误
 */
export function fileNotFound(path: string): string {
  return `Error: File not found at path: ${path}`;
}

/**
 * 文件读取错误
 */
export function fileReadError(path: string, error: string): string {
  return `Error reading file at ${path}: ${error}`;
}

/**
 * 文件写入错误
 */
export function fileWriteError(path: string, error: string): string {
  return `Error writing file at ${path}: ${error}`;
}

/**
 * 命令执行错误
 */
export function commandError(command: string, error: string): string {
  return `Error executing command '${command}': ${error}`;
}

/**
 * 命令执行成功
 */
export function commandSuccess(output: string, exitCode: number = 0): string {
  return `Command executed successfully (exit code: ${exitCode})\n\nOutput:\n${output}`;
}

/**
 * 文件读取成功
 */
export function fileReadSuccess(content: string, path: string): string {
  return `File read successfully from ${path}:\n\n${content}`;
}

/**
 * 文件写入成功
 */
export function fileWriteSuccess(path: string, isNew: boolean = false): string {
  const action = isNew ? 'created' : 'updated';
  return `File ${action} successfully at ${path}`;
}

/**
 * 任务完成响应
 */
export function taskCompletion(result: string): string {
  return `Task completed: ${result}`;
}

/**
 * 格式化文件列表
 */
export function formatFileList(files: string[]): string {
  if (files.length === 0) {
    return 'No files found.';
  }
  return `Found ${files.length} file(s):\n${files.map(f => `  - ${f}`).join('\n')}`;
}

/**
 * 格式化搜索结果
 */
export function formatSearchResults(results: Array<{ file: string; line: number; content: string }>): string {
  if (results.length === 0) {
    return 'No matches found.';
  }
  
  return `Found ${results.length} match(es):\n\n${results.map(r => 
    `${r.file}:${r.line}\n  ${r.content}`
  ).join('\n\n')}`;
}
