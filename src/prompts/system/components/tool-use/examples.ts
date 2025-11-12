/**
 * 🔄 95% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/使用工具/工具使用示例.ts
 * 
 * 核心作用：提供工具使用示例
 */

import type { SystemPromptContext } from '../../types';

/**
 * 获取工具使用示例
 */
export function getToolUseExamples(context: SystemPromptContext): string {
  return `# Tool Use Examples

## Reading a File

<read_file>
<path>src/index.js</path>
</read_file>

## Creating a New File

<write_to_file>
<path>src/components/Button.tsx</path>
<content>
import React from 'react';

export const Button = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};
</content>
</write_to_file>

## Executing a Command

<execute_command>
<command>npm install react</command>
</execute_command>

## Searching Files

<search_files>
<path>src</path>
<regex>function.*Component</regex>
</search_files>

## Asking for Clarification

<ask_followup_question>
<question>Would you like me to add TypeScript types to this component?</question>
</ask_followup_question>`;
}
