import { setSessionState, getSessionState } from './sessionState'
import { readAgentData, writeAgentData, resolveAgentId } from './agentStorage'

export interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  createdAt?: number
  updatedAt?: number
  tags?: string[]
  estimatedHours?: number
  previousStatus?: 'pending' | 'in_progress' | 'completed'
}

export interface TodoQuery {
  status?: TodoItem['status'][]
  priority?: TodoItem['priority'][]
  contentMatch?: string
  tags?: string[]
  dateRange?: { from?: Date; to?: Date }
}

export interface TodoStorageConfig {
  maxTodos: number
  autoArchiveCompleted: boolean
  sortBy: 'createdAt' | 'updatedAt' | 'priority' | 'status'
  sortOrder: 'asc' | 'desc'
}

const TODO_STORAGE_KEY = 'todos'
const TODO_CONFIG_KEY = 'todoConfig'
const TODO_CACHE_KEY = 'todoCache'

// Default configuration
const DEFAULT_CONFIG: TodoStorageConfig = {
  maxTodos: 100,
  autoArchiveCompleted: false,
  sortBy: 'status', // Using smart sorting now
  sortOrder: 'desc',
}

// In-memory cache for performance
let todoCache: TodoItem[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5000 // 5 seconds cache

// Performance metrics
export interface TodoMetrics {
  totalOperations: number
  cacheHits: number
  cacheMisses: number
  lastOperation: number
}

function invalidateCache(): void {
  todoCache = null
  cacheTimestamp = 0
}

function updateMetrics(operation: string, cacheHit: boolean = false): void {
  const sessionState = getSessionState() as any
  const metrics = sessionState.todoMetrics || {
    totalOperations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastOperation: 0,
  }

  metrics.totalOperations++
  metrics.lastOperation = Date.now()

  if (cacheHit) {
    metrics.cacheHits++
  } else {
    metrics.cacheMisses++
  }

  setSessionState({
    ...sessionState,
    todoMetrics: metrics,
  })
}

export function getTodoMetrics(): TodoMetrics {
  const sessionState = getSessionState() as any
  return (
    sessionState.todoMetrics || {
      totalOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastOperation: 0,
    }
  )
}

export function getTodos(agentId?: string): TodoItem[] {
  const resolvedAgentId = resolveAgentId(agentId)
  const now = Date.now()

  // For agent-scoped storage, use file-based storage instead of session state
  if (agentId) {
    updateMetrics('getTodos', false)
    const agentTodos = readAgentData<TodoItem[]>(resolvedAgentId) || []

    // Update cache with agent-specific cache key
    const agentCacheKey = `todoCache_${resolvedAgentId}`
    // Note: In production, we'd want agent-specific caching

    return agentTodos
  }

  // Original session-based storage for backward compatibility
  // Check cache first
  if (todoCache && now - cacheTimestamp < CACHE_TTL) {
    updateMetrics('getTodos', true)
    return todoCache
  }

  updateMetrics('getTodos', false)
  const sessionState = getSessionState()
  const todos = (sessionState as any)[TODO_STORAGE_KEY] || []

  // Update cache
  todoCache = [...todos]
  cacheTimestamp = now

  return todos
}

export function setTodos(todos: TodoItem[], agentId?: string): void {
  const resolvedAgentId = resolveAgentId(agentId)
  const config = getTodoConfig()
  const existingTodos = getTodos(agentId)

  // For agent-scoped storage, use file-based storage
  if (agentId) {
    // Validate todo limit
    if (todos.length > config.maxTodos) {
      throw new Error(
        `Todo limit exceeded. Maximum ${config.maxTodos} todos allowed.`,
      )
    }

    // Auto-archive completed todos if enabled
    let processedTodos = todos
    if (config.autoArchiveCompleted) {
      processedTodos = todos.filter(todo => todo.status !== 'completed')
    }

    const updatedTodos = processedTodos.map(todo => {
      // Find existing todo to track status changes
      const existingTodo = existingTodos.find(
        existing => existing.id === todo.id,
      )

      return {
        ...todo,
        updatedAt: Date.now(),
        createdAt: todo.createdAt || Date.now(),
        previousStatus:
          existingTodo?.status !== todo.status
            ? existingTodo?.status
            : todo.previousStatus,
      }
    })

    // Smart sorting for agent todos
    updatedTodos.sort((a, b) => {
      // 1. Status priority: in_progress > pending > completed
      const statusOrder = { in_progress: 3, pending: 2, completed: 1 }
      const statusDiff = statusOrder[b.status] - statusOrder[a.status]
      if (statusDiff !== 0) return statusDiff

      // 2. For same status, sort by priority: high > medium > low
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff

      // 3. For same status and priority, sort by updatedAt (newest first)
      const aTime = a.updatedAt || 0
      const bTime = b.updatedAt || 0
      return bTime - aTime
    })

    // Write to agent-specific storage
    writeAgentData(resolvedAgentId, updatedTodos)
    updateMetrics('setTodos')
    return
  }

  // Original session-based logic for backward compatibility
  // Validate todo limit
  if (todos.length > config.maxTodos) {
    throw new Error(
      `Todo limit exceeded. Maximum ${config.maxTodos} todos allowed.`,
    )
  }

  // Auto-archive completed todos if enabled
  let processedTodos = todos
  if (config.autoArchiveCompleted) {
    processedTodos = todos.filter(todo => todo.status !== 'completed')
  }

  const updatedTodos = processedTodos.map(todo => {
    // Find existing todo to track status changes
    const existingTodo = existingTodos.find(existing => existing.id === todo.id)

    return {
      ...todo,
      updatedAt: Date.now(),
      createdAt: todo.createdAt || Date.now(),
      previousStatus:
        existingTodo?.status !== todo.status
          ? existingTodo?.status
          : todo.previousStatus,
    }
  })

  // Smart sorting: status -> priority -> updatedAt
  updatedTodos.sort((a, b) => {
    // 1. Status priority: in_progress > pending > completed
    const statusOrder = { in_progress: 3, pending: 2, completed: 1 }
    const statusDiff = statusOrder[b.status] - statusOrder[a.status]
    if (statusDiff !== 0) return statusDiff

    // 2. For same status, sort by priority: high > medium > low
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff

    // 3. For same status and priority, sort by updatedAt (newest first)
    const aTime = a.updatedAt || 0
    const bTime = b.updatedAt || 0
    return bTime - aTime
  })

  setSessionState({
    ...getSessionState(),
    [TODO_STORAGE_KEY]: updatedTodos,
  } as any)

  // Invalidate cache
  invalidateCache()
  updateMetrics('setTodos')
}

export function getTodoConfig(): TodoStorageConfig {
  const sessionState = getSessionState() as any
  return { ...DEFAULT_CONFIG, ...(sessionState[TODO_CONFIG_KEY] || {}) }
}

export function setTodoConfig(config: Partial<TodoStorageConfig>): void {
  const currentConfig = getTodoConfig()
  const newConfig = { ...currentConfig, ...config }

  setSessionState({
    ...getSessionState(),
    [TODO_CONFIG_KEY]: newConfig,
  } as any)

  // Re-sort existing todos if sort order changed
  if (config.sortBy || config.sortOrder) {
    const todos = getTodos()
    setTodos(todos) // This will re-sort according to new config
  }
}

export function addTodo(
  todo: Omit<TodoItem, 'createdAt' | 'updatedAt'>,
): TodoItem[] {
  const todos = getTodos()

  // Check for duplicate IDs
  if (todos.some(existing => existing.id === todo.id)) {
    throw new Error(`Todo with ID '${todo.id}' already exists`)
  }

  const newTodo: TodoItem = {
    ...todo,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const updatedTodos = [...todos, newTodo]
  setTodos(updatedTodos)
  updateMetrics('addTodo')
  return updatedTodos
}

export function updateTodo(id: string, updates: Partial<TodoItem>): TodoItem[] {
  const todos = getTodos()
  const existingTodo = todos.find(todo => todo.id === id)

  if (!existingTodo) {
    throw new Error(`Todo with ID '${id}' not found`)
  }

  const updatedTodos = todos.map(todo =>
    todo.id === id ? { ...todo, ...updates, updatedAt: Date.now() } : todo,
  )

  setTodos(updatedTodos)
  updateMetrics('updateTodo')
  return updatedTodos
}

export function deleteTodo(id: string): TodoItem[] {
  const todos = getTodos()
  const todoExists = todos.some(todo => todo.id === id)

  if (!todoExists) {
    throw new Error(`Todo with ID '${id}' not found`)
  }

  const updatedTodos = todos.filter(todo => todo.id !== id)
  setTodos(updatedTodos)
  updateMetrics('deleteTodo')
  return updatedTodos
}

export function clearTodos(): void {
  setTodos([])
  updateMetrics('clearTodos')
}

export function getTodoById(id: string): TodoItem | undefined {
  const todos = getTodos()
  updateMetrics('getTodoById')
  return todos.find(todo => todo.id === id)
}

export function getTodosByStatus(status: TodoItem['status']): TodoItem[] {
  const todos = getTodos()
  updateMetrics('getTodosByStatus')
  return todos.filter(todo => todo.status === status)
}

export function getTodosByPriority(priority: TodoItem['priority']): TodoItem[] {
  const todos = getTodos()
  updateMetrics('getTodosByPriority')
  return todos.filter(todo => todo.priority === priority)
}

// Advanced query function
export function queryTodos(query: TodoQuery): TodoItem[] {
  const todos = getTodos()
  updateMetrics('queryTodos')

  return todos.filter(todo => {
    // Status filter
    if (query.status && !query.status.includes(todo.status)) {
      return false
    }

    // Priority filter
    if (query.priority && !query.priority.includes(todo.priority)) {
      return false
    }

    // Content search
    if (
      query.contentMatch &&
      !todo.content.toLowerCase().includes(query.contentMatch.toLowerCase())
    ) {
      return false
    }

    // Tags filter
    if (query.tags && todo.tags) {
      const hasMatchingTag = query.tags.some(tag => todo.tags!.includes(tag))
      if (!hasMatchingTag) return false
    }

    // Date range filter
    if (query.dateRange) {
      const todoDate = new Date(todo.createdAt || 0)
      if (query.dateRange.from && todoDate < query.dateRange.from) return false
      if (query.dateRange.to && todoDate > query.dateRange.to) return false
    }

    return true
  })
}

// Utility functions
export function getTodoStatistics() {
  const todos = getTodos()
  const metrics = getTodoMetrics()

  return {
    total: todos.length,
    byStatus: {
      pending: todos.filter(t => t.status === 'pending').length,
      in_progress: todos.filter(t => t.status === 'in_progress').length,
      completed: todos.filter(t => t.status === 'completed').length,
    },
    byPriority: {
      high: todos.filter(t => t.priority === 'high').length,
      medium: todos.filter(t => t.priority === 'medium').length,
      low: todos.filter(t => t.priority === 'low').length,
    },
    metrics,
    cacheEfficiency:
      metrics.totalOperations > 0
        ? Math.round((metrics.cacheHits / metrics.totalOperations) * 100)
        : 0,
  }
}

export function optimizeTodoStorage(): void {
  // Force cache refresh
  invalidateCache()

  // Compact storage by removing any invalid entries
  const todos = getTodos()
  const validTodos = todos.filter(
    todo =>
      todo.id &&
      todo.content &&
      ['pending', 'in_progress', 'completed'].includes(todo.status) &&
      ['high', 'medium', 'low'].includes(todo.priority),
  )

  if (validTodos.length !== todos.length) {
    setTodos(validTodos)
  }

  updateMetrics('optimizeTodoStorage')
}
