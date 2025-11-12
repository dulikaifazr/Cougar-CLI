/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/使用工具/工具调用格式规范.ts
 * 
 * 核心作用：定义工具调用的 XML 格式
 */

import type { SystemPromptContext } from '../../types';

/**
 * 获取工具调用格式规范
 */
export function getToolUseFormatting(context: SystemPromptContext): string {
  return `# Tool Use Formatting

Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</tool_name>

For example:

<read_file>
<path>src/main.js</path>
</read_file>

Always adhere to this format for the tool use to ensure proper parsing and execution.`;
}
