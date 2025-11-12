/**
 * 助手消息解析器
 * 适配自 消息处理/解析助手消息.ts
 * 
 * 核心作用：
 * - 将 AI 返回的原始字符串解析为结构化的内容块（文本 + 工具调用）
 * - 处理混合文本和工具使用块，用类 XML 标签标记
 * 
 * CLI 适配：
 * - 修改导入路径
 * - 保持核心解析逻辑 100% 不变
 */

import { ClineDefaultTool } from '../../prompts/system/tools/types';
import { 
  AssistantMessageContent, 
  TextContent, 
  ToolParamName, 
  ToolUse, 
  toolParamNames,
  toolUseNames 
} from './index';

/**
 * @description **版本 2**
 * 解析可能包含混合文本和工具使用块的助手消息字符串，这些块用类 XML 标签标记，
 * 转换为结构化内容对象数组。
 *
 * 此版本通过避免 V1 的逐字符累加器来追求效率。
 * 它使用索引 `i` 遍历字符串。在每个位置，它检查在 `i` 处*结束*的子字符串
 * 是否使用带偏移量的 `startsWith` 匹配工具或参数的任何已知开始或结束标签。
 * 它使用预计算的 Maps (`toolUseOpenTags`, `toolParamOpenTags`) 进行快速标签查找。
 * 状态使用索引 (`currentTextContentStart`, `currentToolUseStart`, `currentParamValueStart`) 进行管理，
 * 这些索引指向原始 `assistantMessage` 字符串中当前块的开始位置。
 * 仅在块（文本、参数或工具使用）完成时使用切片提取内容。
 * 包含对 `write_to_file` 内容参数的特殊处理，使用 `indexOf`
 * 和 `lastIndexOf` 对相关切片处理可能嵌套的结束标签。
 * 如果输入字符串在块中间结束，则添加最后一个打开的块并将其标记为部分。
 *
 * @param assistantMessage 来自助手的原始字符串输出。
 * @returns `AssistantMessageContent` 对象数组，可以是 `TextContent` 或 `ToolUse`。
 *          在输入字符串结束时未完全关闭的块将其 `partial` 标志设置为 `true`。
 */
export function parseAssistantMessageV2(assistantMessage: string): AssistantMessageContent[] {
  const contentBlocks: AssistantMessageContent[] = [];
  let currentTextContentStart = 0; // 当前文本块开始的索引
  let currentTextContent: TextContent | undefined;
  let currentToolUseStart = 0; // 当前工具使用开始标签*之后*的索引
  let currentToolUse: ToolUse | undefined;
  let currentParamValueStart = 0; // 当前参数开始标签*之后*的索引
  let currentParamName: ToolParamName | undefined;

  // 预计算标签以进行更快的查找
  const toolUseOpenTags = new Map<string, ClineDefaultTool>();
  const toolParamOpenTags = new Map<string, ToolParamName>();
  for (const name of toolUseNames) {
    toolUseOpenTags.set(`<${name}>`, name as ClineDefaultTool);
  }
  for (const name of toolParamNames) {
    toolParamOpenTags.set(`<${name}>`, name);
  }

  const len = assistantMessage.length;
  for (let i = 0; i < len; i++) {
    const currentCharIndex = i;

    // --- 状态: 解析工具参数 ---
    if (currentToolUse && currentParamName) {
      const closeTag = `</${currentParamName}>`;
      // 检查在索引 `i` 处*结束*的字符串是否匹配结束标签
      if (
        currentCharIndex >= closeTag.length - 1 &&
        assistantMessage.startsWith(
          closeTag,
          currentCharIndex - closeTag.length + 1, // 从标签的潜在开始位置开始检查
        )
      ) {
        // 找到参数的结束标签
        const value = assistantMessage
          .slice(
            currentParamValueStart, // 从开始标签之后开始
            currentCharIndex - closeTag.length + 1, // 在结束标签之前结束
          )
          .trim();
        currentToolUse.params[currentParamName] = value;
        currentParamName = undefined; // 返回解析工具内容
        // 我们不在这里继续循环，需要检查索引 i 处的工具关闭或其他参数
      } else {
        continue; // 仍在参数值内部，移动到下一个字符
      }
    }

    // --- 状态: 解析工具使用（但不是特定参数） ---
    if (currentToolUse && !currentParamName) {
      // 确保我们还没有在参数内部
      // 检查是否开始新参数
      let startedNewParam = false;
      for (const [tag, paramName] of toolParamOpenTags.entries()) {
        if (currentCharIndex >= tag.length - 1 && assistantMessage.startsWith(tag, currentCharIndex - tag.length + 1)) {
          currentParamName = paramName;
          currentParamValueStart = currentCharIndex + 1; // 值在标签之后开始
          startedNewParam = true;
          break;
        }
      }
      if (startedNewParam) {
        continue; // 处理参数的开始，移动到下一个字符
      }

      // 检查是否关闭当前工具使用
      const toolCloseTag = `</${currentToolUse.name}>`;
      if (
        currentCharIndex >= toolCloseTag.length - 1 &&
        assistantMessage.startsWith(toolCloseTag, currentCharIndex - toolCloseTag.length + 1)
      ) {
        // 找到工具使用的结束
        // 在最终确定工具*之前*对内容参数进行特殊处理
        const toolContentSlice = assistantMessage.slice(
          currentToolUseStart, // 从工具开始标签之后
          currentCharIndex - toolCloseTag.length + 1, // 到工具结束标签之前
        );

        // 检查内容参数是否需要特殊处理 (write_to_file)
        // 如果参数解析逻辑错过了结束 </content> 标签，此检查很重要
        // （例如，如果内容为空或解析逻辑优先处理工具关闭）
        const contentParamName: ToolParamName = 'content';
        if (
          currentToolUse.name === ClineDefaultTool.WRITE_FILE &&
          toolContentSlice.includes(`<${contentParamName}>`)
        ) {
          const contentStartTag = `<${contentParamName}>`;
          const contentEndTag = `</${contentParamName}>`;
          const contentStart = toolContentSlice.indexOf(contentStartTag);
          // 使用 lastIndexOf 以抵抗嵌套标签
          const contentEnd = toolContentSlice.lastIndexOf(contentEndTag);

          if (contentStart !== -1 && contentEnd !== -1 && contentEnd > contentStart) {
            const contentValue = toolContentSlice.slice(contentStart + contentStartTag.length, contentEnd).trim();
            currentToolUse.params[contentParamName] = contentValue;
          }
        }

        currentToolUse.partial = false; // 标记为完成
        contentBlocks.push(currentToolUse);
        currentToolUse = undefined; // 重置状态
        currentTextContentStart = currentCharIndex + 1; // 潜在文本在此标签之后开始
        continue; // 移动到下一个字符
      }
      // 如果不是开始参数且不是关闭工具，则隐式继续累积工具内容
      continue;
    }

    // --- 状态: 解析文本 / 查找工具开始 ---
    if (!currentToolUse) {
      // 检查是否开始新的工具使用
      let startedNewTool = false;
      for (const [tag, toolName] of toolUseOpenTags.entries()) {
        if (currentCharIndex >= tag.length - 1 && assistantMessage.startsWith(tag, currentCharIndex - tag.length + 1)) {
          // 如果一个文本块处于活动状态，则结束当前文本块
          if (currentTextContent) {
            currentTextContent.content = assistantMessage
              .slice(
                currentTextContentStart, // 从文本开始的位置
                currentCharIndex - tag.length + 1, // 到工具标签开始之前
              )
              .trim();
            currentTextContent.partial = false; // 因为工具开始而结束
            if (currentTextContent.content.length > 0) {
              contentBlocks.push(currentTextContent);
            }
            currentTextContent = undefined;
          } else {
            // 检查最后一个块和此标签之间的任何文本
            const potentialText = assistantMessage
              .slice(
                currentTextContentStart, // 从文本*可能*开始的位置
                currentCharIndex - tag.length + 1, // 到工具标签开始之前
              )
              .trim();
            if (potentialText.length > 0) {
              contentBlocks.push({
                type: 'text',
                content: potentialText,
                partial: false,
              });
            }
          }

          // 开始新的工具使用
          currentToolUse = {
            type: 'tool_use',
            name: toolName,
            params: {},
            partial: true, // 假设为部分，直到找到结束标签
          };
          currentToolUseStart = currentCharIndex + 1; // 工具内容在开始标签之后开始
          startedNewTool = true;
          break;
        }
      }

      if (startedNewTool) {
        continue; // 处理工具的开始，移动到下一个字符
      }

      // 如果不是开始工具，则必须是文本内容
      if (!currentTextContent) {
        // 如果我们还没有在一个文本块中，则开始一个新的文本块
        currentTextContentStart = currentCharIndex; // 文本从当前字符开始
        currentTextContent = {
          type: 'text',
          content: '', // 将在结束时或工具开始时通过切片确定
          partial: true,
        };
      }
      // 隐式继续累积文本；稍后提取内容。
    }
  } // 循环结束

  // --- 循环后的最终化 ---

  // 最终化打开的工具使用中的任何打开参数
  if (currentToolUse && currentParamName) {
    currentToolUse.params[currentParamName] = assistantMessage
      .slice(currentParamValueStart) // 从参数开始到字符串结束
      .trim();
    // 工具使用保持部分状态
  }

  // 最终化任何打开的工具使用（可能包含最终化的部分参数）
  if (currentToolUse) {
    // 工具使用是部分的，因为循环在其结束标签之前完成
    contentBlocks.push(currentToolUse);
  }
  // 最终化任何尾随文本内容
  // 仅在最后没有打开工具使用时才可能
  else if (currentTextContent) {
    currentTextContent.content = assistantMessage
      .slice(currentTextContentStart) // 从文本开始到字符串结束
      .trim();
    // 文本是部分的，因为循环完成
    if (currentTextContent.content.length > 0) {
      contentBlocks.push(currentTextContent);
    }
  }

  return contentBlocks;
}
