import React from 'react'
import { Text, useInput } from 'ink'
import chalk from 'chalk'
import { useTextInput } from '@hooks/useTextInput'
import { getTheme } from '@utils/theme'
import { type Key } from 'ink'

export type Props = {
  /**
   * Optional callback for handling history navigation on up arrow at start of input
   */
  readonly onHistoryUp?: () => void

  /**
   * Optional callback for handling history navigation on down arrow at end of input
   */
  readonly onHistoryDown?: () => void

  /**
   * Text to display when `value` is empty.
   */
  readonly placeholder?: string

  /**
   * Allow multi-line input via line ending with backslash (default: `true`)
   */
  readonly multiline?: boolean

  /**
   * Listen to user's input. Useful in case there are multiple input components
   * at the same time and input must be "routed" to a specific component.
   */
  readonly focus?: boolean

  /**
   * Replace all chars and mask the value. Useful for password inputs.
   */
  readonly mask?: string

  /**
   * Whether to show cursor and allow navigation inside text input with arrow keys.
   */
  readonly showCursor?: boolean

  /**
   * Highlight pasted text
   */
  readonly highlightPastedText?: boolean

  /**
   * Value to display in a text input.
   */
  readonly value: string

  /**
   * Function to call when value updates.
   */
  readonly onChange: (value: string) => void

  /**
   * Function to call when `Enter` is pressed, where first argument is a value of the input.
   */
  readonly onSubmit?: (value: string) => void

  /**
   * Function to call when Ctrl+C is pressed to exit.
   */
  readonly onExit?: () => void

  /**
   * Optional callback to show exit message
   */
  readonly onExitMessage?: (show: boolean, key?: string) => void

  /**
   * Optional callback to show custom message
   */
  readonly onMessage?: (show: boolean, message?: string) => void

  /**
   * Optional callback to reset history position
   */
  readonly onHistoryReset?: () => void

  /**
   * Number of columns to wrap text at
   */
  readonly columns: number

  /**
   * Optional callback when an image is pasted
   */
  readonly onImagePaste?: (base64Image: string) => void

  /**
   * Optional callback when a large text (over 800 chars) is pasted
   */
  readonly onPaste?: (text: string) => void

  /**
   * Whether the input is dimmed and non-interactive
   */
  readonly isDimmed?: boolean

  /**
   * Whether to disable cursor movement for up/down arrow keys
   */
  readonly disableCursorMovementForUpDownKeys?: boolean
  
  /**
   * Optional callback to handle special key combinations before input processing
   * Return true to prevent default handling
   */
  readonly onSpecialKey?: (input: string, key: Key) => boolean

  readonly cursorOffset: number

  /**
   * Callback to set the offset of the cursor
   */
  onChangeCursorOffset: (offset: number) => void
}

export default function TextInput({
  value: originalValue,
  placeholder = '',
  focus = true,
  mask,
  multiline = false,
  highlightPastedText = false,
  showCursor = true,
  onChange,
  onSubmit,
  onExit,
  onHistoryUp,
  onHistoryDown,
  onExitMessage,
  onMessage,
  onHistoryReset,
  columns,
  onImagePaste,
  onPaste,
  isDimmed = false,
  disableCursorMovementForUpDownKeys = false,
  onSpecialKey,
  cursorOffset,
  onChangeCursorOffset,
}: Props) {
  const { onInput, renderedValue } = useTextInput({
    value: originalValue,
    onChange,
    onSubmit,
    onExit,
    onExitMessage,
    onMessage,
    onHistoryReset,
    onHistoryUp,
    onHistoryDown,
    focus,
    mask,
    multiline,
    cursorChar: showCursor ? ' ' : '',
    highlightPastedText,
    invert: chalk.inverse,
    themeText: (text: string) => chalk.hex(getTheme().text)(text),
    columns,
    onImagePaste,
    disableCursorMovementForUpDownKeys,
    externalOffset: cursorOffset,
    onOffsetChange: onChangeCursorOffset,
  })

  // Paste detection state
  const [pasteState, setPasteState] = React.useState<{
    chunks: string[]
    timeoutId: ReturnType<typeof setTimeout> | null
  }>({ chunks: [], timeoutId: null })

  const resetPasteTimeout = (
    currentTimeoutId: ReturnType<typeof setTimeout> | null,
  ) => {
    if (currentTimeoutId) {
      clearTimeout(currentTimeoutId)
    }
    return setTimeout(() => {
      setPasteState(({ chunks }) => {
        const pastedText = chunks.join('')
        // Schedule callback after current render to avoid state updates during render
        Promise.resolve().then(() => onPaste!(pastedText))
        return { chunks: [], timeoutId: null }
      })
    }, 100)
  }

  const wrappedOnInput = (input: string, key: Key): void => {
    // Check for special key combinations first
    if (onSpecialKey && onSpecialKey(input, key)) {
      // Special key was handled, don't process further
      return
    }
    
    // Special handling for backspace or delete
    if (
      key.backspace ||
      key.delete ||
      input === '\b' ||
      input === '\x7f' ||
      input === '\x08'
    ) {
      // Ensure backspace is handled directly
      onInput(input, {
        ...key,
        backspace: true,
      })
      return
    }

    // Handle pastes (>800 chars)
    // Usually we get one or two input characters at a time. If we
    // get a bunch, the user has probably pasted.
    // Unfortunately node batches long pastes, so it's possible
    // that we would see e.g. 1024 characters and then just a few
    // more in the next frame that belong with the original paste.
    // This batching number is not consistent.
    if (onPaste && (input.length > 800 || pasteState.timeoutId)) {
      setPasteState(({ chunks, timeoutId }) => {
        return {
          chunks: [...chunks, input],
          timeoutId: resetPasteTimeout(timeoutId),
        }
      })
      return
    }

    onInput(input, key)
  }

  useInput(wrappedOnInput, { isActive: focus })

  let renderedPlaceholder = placeholder
    ? chalk.hex(getTheme().secondaryText)(placeholder)
    : undefined

  // Fake mouse cursor, because we like punishment
  if (showCursor && focus) {
    renderedPlaceholder =
      placeholder.length > 0
        ? chalk.inverse(placeholder[0]) +
          chalk.hex(getTheme().secondaryText)(placeholder.slice(1))
        : chalk.inverse(' ')
  }

  const showPlaceholder = originalValue.length == 0 && placeholder
  return (
    <Text wrap="truncate-end" dimColor={isDimmed}>
      {showPlaceholder ? renderedPlaceholder : renderedValue}
    </Text>
  )
}
