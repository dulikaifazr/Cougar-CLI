import { Box, Text } from 'ink'
import * as React from 'react'
import { z } from 'zod'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import { TodoItem as TodoItemComponent } from '@components/TodoItem'
import { Tool, ValidationResult } from '@tool'
import { setTodos, getTodos, TodoItem } from '@utils/todoStorage'
import { emitReminderEvent } from '@services/systemReminder'
import { startWatchingTodoFile } from '@services/fileFreshness'
import { DESCRIPTION, PROMPT } from './prompt'
import { getTheme } from '@utils/theme'

const TodoItemSchema = z.object({
  content: z.string().min(1).describe('The task description or content'),
  status: z
    .enum(['pending', 'in_progress', 'completed'])
    .describe('Current status of the task'),
  priority: z
    .enum(['high', 'medium', 'low'])
    .describe('Priority level of the task'),
  id: z.string().min(1).describe('Unique identifier for the task'),
})

const inputSchema = z.strictObject({
  todos: z.array(TodoItemSchema).describe('The updated todo list'),
})

function validateTodos(todos: TodoItem[]): ValidationResult {
  // Check for duplicate IDs
  const ids = todos.map(todo => todo.id)
  const uniqueIds = new Set(ids)
  if (ids.length !== uniqueIds.size) {
    return {
      result: false,
      errorCode: 1,
      message: 'Duplicate todo IDs found',
      meta: {
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      },
    }
  }

  // Check for multiple in_progress tasks
  const inProgressTasks = todos.filter(todo => todo.status === 'in_progress')
  if (inProgressTasks.length > 1) {
    return {
      result: false,
      errorCode: 2,
      message: 'Only one task can be in_progress at a time',
      meta: { inProgressTaskIds: inProgressTasks.map(t => t.id) },
    }
  }

  // Validate each todo
  for (const todo of todos) {
    if (!todo.content?.trim()) {
      return {
        result: false,
        errorCode: 3,
        message: `Todo with ID "${todo.id}" has empty content`,
        meta: { todoId: todo.id },
      }
    }
    if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
      return {
        result: false,
        errorCode: 4,
        message: `Invalid status "${todo.status}" for todo "${todo.id}"`,
        meta: { todoId: todo.id, invalidStatus: todo.status },
      }
    }
    if (!['high', 'medium', 'low'].includes(todo.priority)) {
      return {
        result: false,
        errorCode: 5,
        message: `Invalid priority "${todo.priority}" for todo "${todo.id}"`,
        meta: { todoId: todo.id, invalidPriority: todo.priority },
      }
    }
  }

  return { result: true }
}

function generateTodoSummary(todos: TodoItem[]): string {
  const stats = {
    total: todos.length,
    pending: todos.filter(t => t.status === 'pending').length,
    inProgress: todos.filter(t => t.status === 'in_progress').length,
    completed: todos.filter(t => t.status === 'completed').length,
  }

  // Enhanced summary with statistics
  let summary = `Updated ${stats.total} todo(s)`
  if (stats.total > 0) {
    summary += ` (${stats.pending} pending, ${stats.inProgress} in progress, ${stats.completed} completed)`
  }
  summary += '. Continue tracking your progress with the todo list.'

  return summary
}

export const TodoWriteTool = {
  name: 'TodoWrite',
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  inputSchema,
  userFacingName() {
    return 'Update Todos'
  },
  async isEnabled() {
    return true
  },
  isReadOnly() {
    return false
  },
  isConcurrencySafe() {
    return false // TodoWrite modifies state, not safe for concurrent execution
  },
  needsPermissions() {
    return false
  },
  renderResultForAssistant(result) {
    // Match official implementation - return static confirmation message
    return 'Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable'
  },
  renderToolUseMessage(input, { verbose }) {
    // Show a simple confirmation message when the tool is being used
    return '{ params.todo }'
  },
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />
  },
  renderToolResultMessage(output) {
    const isError = typeof output === 'string' && output.startsWith('Error')

    // For non-error output, get current todos from storage and render them
    if (!isError && typeof output === 'string') {
      const currentTodos = getTodos()
      
      if (currentTodos.length === 0) {
        return (
          <Box flexDirection="column" width="100%">
            <Box flexDirection="row">
              <Text color="#6B7280">&nbsp;&nbsp;⎿ &nbsp;</Text>
              <Text color="#9CA3AF">No todos currently</Text>
            </Box>
          </Box>
        )
      }

      // Sort: [completed, in_progress, pending]
      const sortedTodos = [...currentTodos].sort((a, b) => {
        const order = ['completed', 'in_progress', 'pending']
        return (
          order.indexOf(a.status) - order.indexOf(b.status) ||
          a.content.localeCompare(b.content)
        )
      })

      // Find the next pending task (first pending task after sorting)
      const nextPendingIndex = sortedTodos.findIndex(todo => todo.status === 'pending')

      return (
        <Box flexDirection="column" width="100%">
          {sortedTodos.map((todo: TodoItem, index: number) => {
            // Determine checkbox symbol and colors
            let checkbox: string
            let textColor: string
            let isBold = false
            let isStrikethrough = false

            if (todo.status === 'completed') {
              checkbox = '☒'
              textColor = '#6B7280' // Professional gray for completed
              isStrikethrough = true
            } else if (todo.status === 'in_progress') {
              checkbox = '☐'
              textColor = '#10B981' // Professional green for in progress
              isBold = true
            } else if (todo.status === 'pending') {
              checkbox = '☐'
              // Only the FIRST pending task gets purple highlight
              if (index === nextPendingIndex) {
                textColor = '#8B5CF6' // Professional purple for next pending
                isBold = true
              } else {
                textColor = '#9CA3AF' // Muted gray for other pending
              }
            }

            return (
              <Box key={todo.id || index} flexDirection="row" marginBottom={0}>
                <Text color="#6B7280">&nbsp;&nbsp;⎿ &nbsp;</Text>
                <Box flexDirection="row" flexGrow={1}>
                  <Text color={textColor} bold={isBold} strikethrough={isStrikethrough}>
                    {checkbox}
                  </Text>
                  <Text> </Text>
                  <Text color={textColor} bold={isBold} strikethrough={isStrikethrough}>
                    {todo.content}
                  </Text>
                </Box>
              </Box>
            )
          })}
        </Box>
      )
    }

    // Fallback to simple text rendering for errors or string output
    return (
      <Box justifyContent="space-between" overflowX="hidden" width="100%">
        <Box flexDirection="row">
          <Text color={isError ? getTheme().error : getTheme().success}>
            &nbsp;&nbsp;⎿ &nbsp;
            {typeof output === 'string' ? output : JSON.stringify(output)}
          </Text>
        </Box>
      </Box>
    )
  },
  async validateInput({ todos }: z.infer<typeof inputSchema>) {
    // Type assertion to ensure todos match TodoItem[] interface
    const todoItems = todos as TodoItem[]
    const validation = validateTodos(todoItems)
    if (!validation.result) {
      return validation
    }
    return { result: true }
  },
  async *call({ todos }: z.infer<typeof inputSchema>, context) {
    try {
      // Get agent ID from context
      const agentId = context?.agentId

      // Start watching todo file for this agent if not already watching
      if (agentId) {
        startWatchingTodoFile(agentId)
      }

      // Store previous todos for comparison (agent-scoped)
      const previousTodos = getTodos(agentId)

      // Type assertion to ensure todos match TodoItem[] interface
      const todoItems = todos as TodoItem[]

      // Note: Validation already done in validateInput, no need for duplicate validation
      // This eliminates the double validation issue

      // Update the todos in storage (agent-scoped)
      setTodos(todoItems, agentId)

      // Emit todo change event for system reminders (optimized - only if todos actually changed)
      const hasChanged =
        JSON.stringify(previousTodos) !== JSON.stringify(todoItems)
      if (hasChanged) {
        emitReminderEvent('todo:changed', {
          previousTodos,
          newTodos: todoItems,
          timestamp: Date.now(),
          agentId: agentId || 'default',
          changeType:
            todoItems.length > previousTodos.length
              ? 'added'
              : todoItems.length < previousTodos.length
                ? 'removed'
                : 'modified',
        })
      }

      // Generate enhanced summary
      const summary = generateTodoSummary(todoItems)

      // Enhanced result data for rendering
      const resultData = {
        oldTodos: previousTodos,
        newTodos: todoItems,
        summary,
      }

      yield {
        type: 'result',
        data: summary, // Return string to satisfy interface
        resultForAssistant: summary,
        // Store todo data in a way accessible to the renderer
        // We'll modify the renderToolResultMessage to get todos from storage
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      const errorResult = `Error updating todos: ${errorMessage}`

      // Emit error event for system monitoring
      emitReminderEvent('todo:error', {
        error: errorMessage,
        timestamp: Date.now(),
        agentId: context?.agentId || 'default',
        context: 'TodoWriteTool.call',
      })

      yield {
        type: 'result',
        data: errorResult,
        resultForAssistant: errorResult,
      }
    }
  },
} satisfies Tool<typeof inputSchema, string>
