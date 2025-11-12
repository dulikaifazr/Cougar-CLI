// 核心作用：提供统一的消息格式化功能，用于生成各种返回给 AI 的格式化消息
import * as diff from 'diff';
import * as path from 'path';

// 工具函数：将路径转换为 POSIX 格式
function toPosix(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

// 扩展 String 原型（仅用于内部）
declare global {
  interface String {
    toPosix(): string;
  }
}

String.prototype.toPosix = function() {
  return toPosix(this.toString());
};

/**
 * 格式化响应消息的核心对象
 * 包含所有向 AI 返回的标准化消息模板
 */
export const formatResponse = {
  /**
   * 重复文件读取通知
   */
  duplicateFileReadNotice: () =>
    `[[NOTE] This file read has been removed to save space in the context window. Refer to the latest file read for the most up to date version of this file.]`,

  /**
   * 上下文截断通知
   */
  contextTruncationNotice: () =>
    `[NOTE] Some previous conversation history with the user has been removed to maintain optimal context window length. The initial user task has been retained for continuity, while intermediate conversation history has been removed. Keep this in mind as you continue assisting the user. Pay special attention to the user's latest messages.`,

  /**
   * 处理首条用户消息的截断
   */
  processFirstUserMessageForTruncation: (originalContent: string) => {
    const MAX_CHARS = 400_000;

    if (originalContent.length <= MAX_CHARS) {
      return originalContent;
    }

    const truncated = originalContent.substring(0, MAX_CHARS);
    return truncated + '\n\n[[NOTE] This message was truncated past this point to preserve context window space.]';
  },

  /**
   * 压缩对话响应
   */
  condense: () =>
    `The user has accepted the condensed conversation summary you generated. This summary covers important details of the historical conversation with the user which has been truncated.\n<explicit_instructions type="condense_response">It's crucial that you respond by ONLY asking the user what you should work on next. You should NOT take any initiative or make any assumptions about continuing with work. For example you should NOT suggest file changes or attempt to read any files.\nWhen asking the user what you should work on next, you can reference information in the summary which was just generated. However, you should NOT reference information outside of what's contained in the summary for this response. Keep this response CONCISE.</explicit_instructions>`,

  /**
   * 工具被拒绝
   */
  toolDenied: () => `The user denied this operation.`,

  /**
   * 工具执行错误
   */
  toolError: (error?: string) => `The tool execution failed with the following error:\n<error>\n${error}\n</error>`,

  /**
   * 文件访问被阻止错误
   */
  fileAccessError: (filePath: string) =>
    `Access to ${filePath} is blocked by file access settings. You must try to continue in the task without using this file, or ask the user to update the access settings.`,

  /**
   * 未使用工具错误
   */
  noToolsUsed: () =>
    `[ERROR] You did not use a tool in your previous response! Please retry with a tool use.\n\n${toolUseInstructionsReminder}\n\n# Next Steps\n\nIf you have completed the user's task, use the attempt_completion tool. \nIf you require additional information from the user, use the ask_followup_question tool. \nOtherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task. \n(This is an automated message, so do not respond to it conversationally.)`,

  /**
   * 错误过多提示
   */
  tooManyMistakes: (feedback?: string) =>
    `You seem to be having trouble proceeding. The user has provided the following feedback to help guide you:\n<feedback>\n${feedback}\n</feedback>`,

  /**
   * 自动批准达到上限
   */
  autoApprovalMaxReached: (feedback?: string) =>
    `Auto-approval limit reached. The user has provided the following feedback to help guide you:\n<feedback>\n${feedback}\n</feedback>`,

  /**
   * 缺少必需参数错误
   */
  missingToolParameterError: (paramName: string) =>
    `Missing value for required parameter '${paramName}'. Please retry with complete response.\n\n${toolUseInstructionsReminder}`,

  /**
   * 无效的 MCP 工具参数错误
   */
  invalidMcpToolArgumentError: (serverName: string, toolName: string) =>
    `Invalid JSON argument used with ${serverName} for ${toolName}. Please retry with a properly formatted JSON argument.`,

  /**
   * 工具结果（支持图片和文件）
   */
  toolResult: (text: string, images?: string[], fileString?: string) => {
    const toolResultOutput: any[] = [];

    if (!(images && images.length > 0) && !fileString) {
      return text;
    }

    const textBlock = { type: 'text', text };
    toolResultOutput.push(textBlock);

    if (images && images.length > 0) {
      const imageBlocks = formatImagesIntoBlocks(images);
      toolResultOutput.push(...imageBlocks);
    }

    if (fileString) {
      const fileBlock = { type: 'text', text: fileString };
      toolResultOutput.push(fileBlock);
    }

    return toolResultOutput;
  },

  /**
   * 图片块格式化
   */
  imageBlocks: (images?: string[]) => {
    return formatImagesIntoBlocks(images);
  },

  /**
   * 格式化文件列表
   */
  formatFilesList: (
    absolutePath: string,
    files: string[],
    didHitLimit: boolean
  ): string => {
    const sorted = files
      .map((file) => {
        const relativePath = path.relative(absolutePath, file).toPosix();
        return file.endsWith('/') ? relativePath + '/' : relativePath;
      })
      .sort((a, b) => {
        const aParts = a.split('/');
        const bParts = b.split('/');
        for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
          if (aParts[i] !== bParts[i]) {
            if (i + 1 === aParts.length && i + 1 < bParts.length) {
              return -1;
            }
            if (i + 1 === bParts.length && i + 1 < aParts.length) {
              return 1;
            }
            return aParts[i].localeCompare(bParts[i], undefined, {
              numeric: true,
              sensitivity: 'base',
            });
          }
        }
        return aParts.length - bParts.length;
      });

    if (didHitLimit) {
      return `${sorted.join('\n')}\n\n(File list truncated. Use list_files on specific subdirectories if you need to explore further.)`;
    } else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === '')) {
      return 'No files found.';
    } else {
      return sorted.join('\n');
    }
  },

  /**
   * 创建美化的 diff 补丁
   */
  createPrettyPatch: (filename = 'file', oldStr?: string, newStr?: string) => {
    const patch = diff.createPatch(filename.toPosix(), oldStr || '', newStr || '');
    const lines = patch.split('\n');
    const prettyPatchLines = lines.slice(4);
    return prettyPatchLines.join('\n');
  },

  /**
   * 任务恢复消息
   */
  taskResumption: (
    mode: 'act' | 'plan',
    agoText: string,
    cwd: string,
    wasRecent: boolean | 0 | undefined,
    responseText?: string,
    hasPendingFileContextWarnings?: boolean
  ): [string, string] => {
    const taskResumptionMessage = `[TASK RESUMPTION] ${
      mode === 'plan'
        ? `This task was interrupted ${agoText}. The conversation may have been incomplete. Be aware that the project state may have changed since then. The current working directory is now '${cwd.toPosix()}'.\n\nNote: If you previously attempted a tool use that the user did not provide a result for, you should assume the tool use was not successful. However you are in PLAN MODE, so rather than continuing the task, you must respond to the user's message.`
        : `This task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. The current working directory is now '${cwd.toPosix()}'. If the task has not been completed, retry the last step before interruption and proceed with completing the task.\n\nNote: If you previously attempted a tool use that the user did not provide a result for, you should assume the tool use was not successful and assess whether you should retry. If the last tool was a browser_action, the browser has been closed and you must launch a new browser if needed.`
    }${
      wasRecent && !hasPendingFileContextWarnings
        ? '\n\nIMPORTANT: If the last tool use was a replace_in_file or write_to_file that was interrupted, the file was reverted back to its original state before the interrupted edit, and you do NOT need to re-read the file as you already have its up-to-date contents.'
        : ''
    }`;

    const userResponseMessage = `${
      responseText
        ? `${mode === 'plan' ? 'New message to respond to with plan_mode_respond tool (be sure to provide your response in the <response> parameter)' : 'New instructions for task continuation'}:\n<user_message>\n${responseText}\n</user_message>`
        : mode === 'plan'
          ? "(The user did not provide a new message. Consider asking them how they'd like you to proceed, or suggest to them to switch to Act mode to continue with the task.)"
          : ''
    }`;

    return [taskResumptionMessage, userResponseMessage];
  },

  /**
   * 计划模式指令
   */
  planModeInstructions: () => {
    return `In this mode you should focus on information gathering, asking questions, and architecting a solution. Once you have a plan, use the plan_mode_respond tool to engage in a conversational back and forth with the user. Do not use the plan_mode_respond tool until you've gathered all the information you need e.g. with read_file or ask_followup_question.\n(Remember: If it seems the user wants you to use tools only available in Act Mode, you should ask the user to "toggle to Act mode" (use those words) - they will have to manually do this themselves with the Plan/Act toggle button below. You do not have the ability to switch to Act Mode yourself, and must wait for the user to do it themselves once they are satisfied with the plan. You also cannot present an option to toggle to Act mode, as this will be something you need to direct the user to do manually themselves.)`;
  },

  /**
   * 文件编辑（包含用户修改）
   */
  fileEditWithUserChanges: (
    relPath: string,
    userEdits: string,
    autoFormattingEdits: string | undefined,
    finalContent: string | undefined,
    newProblemsMessage: string | undefined
  ) =>
    `The user made the following updates to your content:\n\n${userEdits}\n\n` +
    (autoFormattingEdits
      ? `The user's editor also applied the following auto-formatting to your content:\n\n${autoFormattingEdits}\n\n(Note: Pay close attention to changes such as single quotes being converted to double quotes, semicolons being removed or added, long lines being broken into multiple lines, adjusting indentation style, adding/removing trailing commas, etc. This will help you ensure future SEARCH/REPLACE operations to this file are accurate.)\n\n`
      : '') +
    `The updated content, which includes both your original modifications and the additional edits, has been successfully saved to ${relPath.toPosix()}. Here is the full, updated content of the file that was saved:\n\n` +
    `<final_file_content path="${relPath.toPosix()}">\n${finalContent}\n</final_file_content>\n\n` +
    `Please note:\n` +
    `1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
    `2. Proceed with the task using this updated file content as the new baseline.\n` +
    `3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
    `4. IMPORTANT: For any future changes to this file, use the final_file_content shown above as your reference. This content reflects the current state of the file, including both user edits and any auto-formatting (e.g., if you used single quotes but the formatter converted them to double quotes). Always base your SEARCH/REPLACE operations on this final version to ensure accuracy.\n` +
    `${newProblemsMessage}`,

  /**
   * 文件编辑（不包含用户修改）
   */
  fileEditWithoutUserChanges: (
    relPath: string,
    autoFormattingEdits: string | undefined,
    finalContent: string | undefined,
    newProblemsMessage: string | undefined
  ) =>
    `The content was successfully saved to ${relPath.toPosix()}.\n\n` +
    (autoFormattingEdits
      ? `Along with your edits, the user's editor applied the following auto-formatting to your content:\n\n${autoFormattingEdits}\n\n(Note: Pay close attention to changes such as single quotes being converted to double quotes, semicolons being removed or added, long lines being broken into multiple lines, adjusting indentation style, adding/removing trailing commas, etc. This will help you ensure future SEARCH/REPLACE operations to this file are accurate.)\n\n`
      : '') +
    `Here is the full, updated content of the file that was saved:\n\n` +
    `<final_file_content path="${relPath.toPosix()}">\n${finalContent}\n</final_file_content>\n\n` +
    `IMPORTANT: For any future changes to this file, use the final_file_content shown above as your reference. This content reflects the current state of the file, including any auto-formatting (e.g., if you used single quotes but the formatter converted them to double quotes). Always base your SEARCH/REPLACE operations on this final version to ensure accuracy.\n\n` +
    `${newProblemsMessage}`,

  /**
   * Diff 错误
   */
  diffError: (relPath: string, originalContent: string | undefined) =>
    `This is likely because the SEARCH block content doesn't match exactly with what's in the file, or if you used multiple SEARCH/REPLACE blocks they may not have been in the order they appear in the file. (Please also ensure that when using the replace_in_file tool, Do NOT add extra characters to the markers (e.g., ------- SEARCH> is INVALID). Do NOT forget to use the closing +++++++ REPLACE marker. Do NOT modify the marker format in any way. Malformed XML will cause complete tool failure and break the entire editing process.)\n\n` +
    `The file was reverted to its original state:\n\n` +
    `<file_content path="${relPath.toPosix()}">\n${originalContent}\n</file_content>\n\n` +
    `Now that you have the latest state of the file, try the operation again with fewer, more precise SEARCH blocks. For large files especially, it may be prudent to try to limit yourself to <5 SEARCH/REPLACE blocks at a time, then wait for the user to respond with the result of the operation before following up with another replace_in_file call to make additional edits.\n(If you run into this error 3 times in a row, you may use the write_to_file tool as a fallback.)`,

  /**
   * 工具已使用
   */
  toolAlreadyUsed: (toolName: string) =>
    `Tool [${toolName}] was not executed because a tool has already been used in this message. Only one tool may be used per message. You must assess the first tool's result before proceeding to use the next tool.`,

  /**
   * 文件上下文警告
   */
  fileContextWarning: (editedFiles: string[]): string => {
    const fileCount = editedFiles.length;
    const fileVerb = fileCount === 1 ? 'file has' : 'files have';
    const fileDemonstrativePronoun = fileCount === 1 ? 'this file' : 'these files';
    const filePersonalPronoun = fileCount === 1 ? 'it' : 'they';

    return (
      `<explicit_instructions>\nCRITICAL FILE STATE ALERT: ${fileCount} ${fileVerb} been externally modified since your last interaction. Your cached understanding of ${fileDemonstrativePronoun} is now stale and unreliable. Before making ANY modifications to ${fileDemonstrativePronoun}, you must execute read_file to obtain the current state, as ${filePersonalPronoun} may contain completely different content than what you expect:\n` +
      `${editedFiles.map((file) => ` ${path.resolve(file).toPosix()}`).join('\n')}\n` +
      `Failure to re-read before editing will result in replace_in_file edit errors, requiring subsequent attempts and wasting tokens. You DO NOT need to re-read these files after subsequent edits, unless instructed to do so.\n</explicit_instructions>`
    );
  },

  /**
   * 格式化错误消息（用于CLI）
   */
  formatError: (error: any): string => {
    let errorMessage = '❌ 错误: ';
    
    if (error.message) {
      errorMessage += error.message;
    } else if (typeof error === 'string') {
      errorMessage += error;
    } else {
      errorMessage += JSON.stringify(error);
    }
    
    if (error.status) {
      errorMessage += `\n   状态码: ${error.status}`;
    }
    
    if (error.code) {
      errorMessage += `\n   错误代码: ${error.code}`;
    }
    
    if (error.response?.data) {
      errorMessage += `\n   详情: ${JSON.stringify(error.response.data)}`;
    }
    
    return errorMessage;
  },
};

/**
 * 图片格式化辅助函数
 * 将 base64 图片数据转换为标准块格式
 */
const formatImagesIntoBlocks = (images?: string[]) => {
  return images
    ? images.map((dataUrl) => {
        // data:image/png;base64,base64string
        const [rest, base64] = dataUrl.split(',');
        const mimeType = rest.split(':')[1].split(';')[0];
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64,
          },
        };
      })
    : [];
};

/**
 * 工具使用指令提醒
 */
const toolUseInstructionsReminder = `# Reminder: Instructions for Tool Use

Tool uses are formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</tool_name>

For example:

<attempt_completion>
<result>
I have completed the task...
</result>
</attempt_completion>

Always adhere to this format for all tool uses to ensure proper parsing and execution.`;
