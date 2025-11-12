/*TaskState 是任务执行引擎的"状态容器"，集中管理任务运行过程中的所有运行时状态。
可以把它理解为任务的"内存大脑"，记录着任务当前所处的状态、进度和各种标志位。
它是任务执行引擎的"神经中枢"，所有状态变化都在这里反映！
*/
import { Anthropic } from "@anthropic-ai/sdk"
import { AssistantMessageContent } from "../assistant-message"

/**
 * Cline 询问响应类型
 */
export enum ClineAskResponse {
  yesButtonClicked = 'yesButtonClicked',
  noButtonClicked = 'noButtonClicked',
  messageResponse = 'messageResponse',
  switchToActMode = 'switchToActMode',
  switchToPlanMode = 'switchToPlanMode',
  resumeTask = 'resumeTask',
  resumeCompletedTask = 'resumeCompletedTask',
}

export class TaskState {
	// 流式标志
	isStreaming = false
	isWaitingForFirstChunk = false
	didCompleteReadingStream = false

	// 内容处理
	currentStreamingContentIndex = 0
	assistantMessageContent: AssistantMessageContent[] = []
	userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
	userMessageContentReady = false

	// 呈现锁
	presentAssistantMessageLocked = false
	presentAssistantMessageHasPendingUpdates = false

	// 问/响应处理
	askResponse?: ClineAskResponse
	askResponseText?: string
	askResponseImages?: string[]
	askResponseFiles?: string[]
	lastMessageTs?: number

	// 计划模式特定状态
	isAwaitingPlanResponse = false
	didRespondToPlanAskBySwitchingMode = false

	// 上下文和历史
	conversationHistoryDeletedRange?: [number, number]

	// 工具执行标志
	didRejectTool = false
	didAlreadyUseTool = false
	didEditFile: boolean = false

	// 连续请求跟踪
	consecutiveAutoApprovedRequestsCount: number = 0

	// 错误跟踪
	consecutiveMistakeCount: number = 0
	didAutomaticallyRetryFailedApiRequest = false
	checkpointManagerErrorMessage?: string

	// 重试跟踪自动重试功能
	autoRetryAttempts: number = 0

	// 任务初始化
	isInitialized = false

	// 焦点链 / 待办事项管理
	apiRequestCount: number = 0
	apiRequestsSinceLastTodoUpdate: number = 0
	currentFocusChainChecklist: string | null = null
	todoListWasUpdatedByUser: boolean = false

	// 任务中止 / 取消
	abort: boolean = false
	didFinishAbortingStream = false
	abandoned = false

	// 自动上下文总结
	currentlySummarizing: boolean = false
	lastAutoCompactTriggerIndex?: number

	// 对话历史管理（CLI 新增）
	shouldClearHistory: boolean = false
	shouldCompressHistory: boolean = false
}
