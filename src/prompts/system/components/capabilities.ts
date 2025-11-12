/**
 * 🔄 100% 复用自原系统（CLI适配版）
 * 来源: 提示词/系统提示词/提示词组件/Agent 能力说明.ts
 * 
 * 核心作用：详细说明 Agent 的能力
 * 
 * CLI 适配说明：
 * - 移除 VSCode terminal 引用
 * - 修改为 CLI 环境描述
 * - 已修复：与官方CLI版本100%一致
 */

import type { SystemPromptContext } from '../types';

/**
 * 获取 Agent 能力说明
 */
export function getCapabilities(context: SystemPromptContext): string {
  const browserSupport = context.supportsBrowserUse ? ', use the browser' : '';
  const cwd = context.cwd || process.cwd();
  
  let capabilities = `CAPABILITIES

- You have access to tools that let you execute CLI commands on the user's computer, list files, view source code definitions, regex search${browserSupport}, read and edit files, and ask follow-up questions. These tools help you effectively accomplish a wide range of tasks, such as writing code, making edits or improvements to existing files, understanding the current state of a project, performing system operations, and much more.
- When the user initially gives you a task, a recursive list of all filepaths in the current working directory ('${cwd}') will be included in environment_details. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can also guide decision-making on which files to explore further. If you need to further explore directories such as outside the current working directory, you can use the list_files tool. If you pass 'true' for the recursive parameter, it will list files recursively. Otherwise, it will list files at the top level, which is better suited for generic directories where you don't necessarily need the nested structure, like the Desktop.
- You can use search_files to perform regex searches across files in a specified directory, outputting context-rich results that include surrounding lines. The tool returns a count of total matches and a count of unique files containing matches. CRITICAL: When analyzing search_files results, ALWAYS use the file count directly from the tool output (e.g., "Found X results across Y files"). DO NOT attempt to re-count or re-analyze the results yourself. DO NOT assume one file exports only one type of item - files often contain multiple export types. Trust the tool's statistics completely. This is particularly useful for understanding code patterns, finding specific implementations, or identifying areas that need refactoring.
- You can use the list_code_definition_names tool to get an overview of source code definitions for all files at the top level of a specified directory. This can be particularly useful when you need to understand the broader context and relationships between certain parts of the code. You may need to call this tool multiple times to understand various parts of the codebase related to the task.
	- For example, when asked to make edits or improvements you might analyze the file structure in the initial environment_details to get an overview of the project, then use list_code_definition_names to get further insight using source code definitions for files located in relevant directories, then read_file to examine the contents of relevant files, analyze the code and suggest improvements or make necessary edits, then use the write_to_file tool to implement changes. If you refactored code that could affect other parts of the codebase, you could use search_files to ensure you update other files as needed.
- You can use the execute_command tool to run commands on the user's computer whenever you feel it can help accomplish the user's task. When you need to execute a CLI command, you must provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, since they are more flexible and easier to run. Commands are run in a shell environment and you will be kept updated on their status.`;
  
  // 浏览器支持
  if (context.supportsBrowserUse) {
    capabilities += `\n- You can use the browser_action tool to interact with websites (including html files and locally running development servers) through a browser when you feel it is necessary in accomplishing the user's task. This tool is particularly useful for web development tasks as it allows you to launch a browser, navigate to pages, interact with elements through clicks and keyboard input, and capture the results through screenshots and console logs. This tool may be useful at key stages of web development tasks-such as after implementing new features, making substantial changes, when troubleshooting issues, or to verify the result of your work. You can analyze the provided screenshots to ensure correct rendering or identify errors, and review console logs for runtime issues.
	- For example, if asked to add a component to a react website, you might create the necessary files, use execute_command to run the site locally, then use browser_action to launch the browser, navigate to the local server, and verify the component renders & functions correctly before closing the browser.`;
  }
  
  // MCP 服务器支持
  capabilities += `\n- You have access to MCP servers that may provide additional tools and resources. Each server may provide different capabilities that you can use to accomplish tasks more effectively.`;
  
  return capabilities;
}
