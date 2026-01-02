// Theme type definitions for CustomSelect components
// Used by select.tsx and select-option.tsx

import type { BoxProps, TextProps } from 'ink'

/**
 * Theme interface for CustomSelect components
 * Defines the style functions used by the select components
 */
export interface Theme {
  /**
   * Collection of style functions
   */
  styles: {
    /**
     * Container styles for the select box
     */
    container(): BoxProps

    /**
     * Styles for individual option containers
     */
    option(props: { isFocused: boolean }): BoxProps

    /**
     * Styles for the focus indicator (arrow/pointer)
     */
    focusIndicator(): TextProps

    /**
     * Styles for option labels
     */
    label(props: { isFocused: boolean; isSelected: boolean }): TextProps

    /**
     * Styles for the selected indicator (checkmark)
     */
    selectedIndicator(): TextProps

    /**
     * Styles for highlighted text in option labels
     */
    highlightedText(): TextProps
  }
}