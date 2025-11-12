/**
 * 🔧 浏览器操作工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/浏览器操作工具定义.ts
 * 
 * 作用：通过 Puppeteer 控制浏览器
 * 
 * 用途：
 * - 启动浏览器并导航
 * - 与网页元素交互
 * - 截图和捕获控制台日志
 * - 测试 Web 应用
 * 
 * 参数：
 * - action：launch、click、type、screenshot、close 等
 * - url、selector、text 等（根据动作类型）
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, type ClineToolSpec } from './types';

const id = ClineDefaultTool.BROWSER_ACTION;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'browser_action',
  description: `请求与 Puppeteer 控制的浏览器交互。除 \`close\` 外的每个操作都将以浏览器当前状态的屏幕截图以及任何新的控制台日志进行响应。每条消息只能执行一个浏览器操作，并等待用户的响应（包括屏幕截图和日志）以确定下一个操作。
- 操作序列**必须始终以**在 URL 启动浏览器开始，**并且必须始终以**关闭浏览器结束。如果您需要访问无法从当前网页导航到的新 URL，则必须先关闭浏览器，然后在新 URL 再次启动。
- 当浏览器处于活动状态时，只能使用 \`browser_action\` 工具。在此期间不应调用其他工具。只有在关闭浏览器后，您才能继续使用其他工具。例如，如果遇到错误需要修复文件，必须先关闭浏览器，然后使用其他工具进行必要的更改，然后重新启动浏览器以验证结果。
- 浏览器窗口的分辨率为 **{{BROWSER_VIEWPORT_WIDTH}}x{{BROWSER_VIEWPORT_HEIGHT}}** 像素。执行任何单击操作时，请确保坐标在此分辨率范围内。
- 在单击任何元素（如图标、链接或按钮）之前，您必须查阅提供的页面屏幕截图以确定元素的坐标。单击应针对**元素的中心**，而不是其边缘。`,
  parameters: [
    {
      name: 'action',
      required: true,
      instruction: `要执行的操作。可用的操作有: 
	* launch: 在指定的 URL 启动新的 Puppeteer 控制的浏览器实例。这**必须始终是第一个操作**。 
		- 与 \`url\` 参数一起使用以提供 URL。 
		- 确保 URL 有效并包含适当的协议（例如 http://localhost:3000/page, file:///path/to/file.html 等） 
	* click: 在特定的 x,y 坐标处单击。 
		- 与 \`coordinate\` 参数一起使用以指定位置。 
		- 根据从屏幕截图派生的坐标，始终单击元素（图标、按钮、链接等）的中心。 
	* type: 在键盘上键入文本字符串。您可以在单击文本字段后使用此选项来输入文本。 
		- 与 \`text\` 参数一起使用以提供要键入的字符串。 
	* scroll_down: 按一个页面高度向下滚动页面。 
	* scroll_up: 按一个页面高度向上滚动页面。 
	* close: 关闭 Puppeteer 控制的浏览器实例。这**必须始终是最后一个浏览器操作**。 
	    - 示例: \`<action>close</action>\``,
      usage: '要执行的操作（例如，launch, click, type, scroll_down, scroll_up, close）',
    },
    {
      name: 'url',
      required: false,
      instruction: `用于为 \`launch\` 操作提供 URL。 
	* 示例: <url>https://example.com</url>`,
      usage: '启动浏览器的 URL（可选）',
    },
    {
      name: 'coordinate',
      required: false,
      instruction: `\`click\` 操作的 X 和 Y 坐标。坐标应在 **{{BROWSER_VIEWPORT_WIDTH}}x{{BROWSER_VIEWPORT_HEIGHT}}** 分辨率范围内。 
	* 示例: <coordinate>450,300</coordinate>`,
      usage: 'x,y 坐标（可选）',
    },
    {
      name: 'text',
      required: false,
      instruction: `用于为 \`type\` 操作提供文本。 
	* 示例: <text>Hello, world!</text>`,
      usage: '要键入的文本（可选）',
    },
  ],
};

export const browser_action_variants = [generic];