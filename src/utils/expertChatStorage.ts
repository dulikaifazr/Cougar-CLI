import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

/**
 * Expert Chat Session Storage - 极简版
 * 存储符合OpenAI格式的messages历史
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ExpertChatSession {
  sessionId: string
  expertModel: string
  messages: ChatMessage[]
  createdAt: number
  lastUpdated: number
}

/**
 * 获取专家聊天存储目录
 */
function getExpertChatDirectory(): string {
  const configDir =
    process.env.COUGAR_CONFIG_DIR ?? process.env.ANYCOUGAR_CONFIG_DIR ?? join(homedir(), '.cougar')
  const expertChatDir = join(configDir, 'expert-chats')

  if (!existsSync(expertChatDir)) {
    mkdirSync(expertChatDir, { recursive: true })
  }

  return expertChatDir
}

/**
 * 获取会话文件路径 - 使用 sessionId.json 格式
 */
function getSessionFilePath(sessionId: string): string {
  return join(getExpertChatDirectory(), `${sessionId}.json`)
}

/**
 * 创建新的专家聊天会话
 */
export function createExpertChatSession(
  expertModel: string,
): ExpertChatSession {
  const sessionId = randomUUID().slice(0, 5)
  const session: ExpertChatSession = {
    sessionId,
    expertModel,
    messages: [],
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  }

  saveExpertChatSession(session)
  return session
}

/**
 * 加载现有专家聊天会话
 */
export function loadExpertChatSession(
  sessionId: string,
): ExpertChatSession | null {
  const filePath = getSessionFilePath(sessionId)

  if (!existsSync(filePath)) {
    return null
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as ExpertChatSession
  } catch (error) {
    console.error(`Failed to load expert chat session ${sessionId}:`, error)
    return null
  }
}

/**
 * 保存专家聊天会话
 */
export function saveExpertChatSession(session: ExpertChatSession): void {
  const filePath = getSessionFilePath(session.sessionId)

  try {
    session.lastUpdated = Date.now()
    writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
  } catch (error) {
    console.error(
      `Failed to save expert chat session ${session.sessionId}:`,
      error,
    )
    throw error
  }
}

/**
 * 添加消息到会话
 */
export function addMessageToSession(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
): ExpertChatSession | null {
  const session = loadExpertChatSession(sessionId)
  if (!session) {
    return null
  }

  session.messages.push({ role, content })
  saveExpertChatSession(session)

  return session
}

/**
 * 获取会话的消息历史 - 返回OpenAI格式
 */
export function getSessionMessages(sessionId: string): ChatMessage[] {
  const session = loadExpertChatSession(sessionId)
  return session?.messages || []
}

/**
 * 生成新的会话ID
 */
export function generateSessionId(): string {
  return randomUUID().slice(0, 5)
}
