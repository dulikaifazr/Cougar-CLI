import React from 'react'
import { Box, Text } from 'ink'
import { usePermissionContext } from '@context/PermissionContext'
import { getTheme } from '@utils/theme'

interface ModeIndicatorProps {
  showTransitionCount?: boolean
}

export function ModeIndicator({
  showTransitionCount = false,
}: ModeIndicatorProps) {
  const { currentMode, permissionContext, getModeConfig } =
    usePermissionContext()
  const theme = getTheme()
  const modeConfig = getModeConfig()

  // Don't show indicator for default mode unless explicitly requested
  if (currentMode === 'default' && !showTransitionCount) {
    return null
  }

  return (
    <Box borderStyle="single" padding={1} marginY={1}>
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center">
          <Text color={getThemeColor(modeConfig.color, theme)} bold>
            {modeConfig.icon} {modeConfig.label}
          </Text>
        </Box>

        <Text color="gray" dimColor>
          {modeConfig.description}
        </Text>

        <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
          <Text color="gray" dimColor>
            Press Shift+Tab to cycle modes
          </Text>
          {showTransitionCount && (
            <Text color="gray" dimColor>
              Switches: {permissionContext.metadata.transitionCount}
            </Text>
          )}
        </Box>

        {currentMode === 'plan' && (
          <Box marginTop={1}>
            <Text color="cyan" dimColor>
              Available tools: {permissionContext.allowedTools.join(', ')}
            </Text>
            <Text color="yellow" dimColor>
              Use exit_plan_mode tool when ready to execute
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

function getThemeColor(colorName: string, theme: any): string {
  const colorMap: Record<string, string> = {
    blue: theme.primary || 'blue',
    green: theme.success || 'green',
    yellow: theme.warning || 'yellow',
    red: theme.error || 'red',
  }

  return colorMap[colorName] || colorName
}

// Compact mode indicator for status bar
export function CompactModeIndicator() {
  const { currentMode, getModeConfig } = usePermissionContext()
  const modeConfig = getModeConfig()
  const theme = getTheme()

  if (currentMode === 'default') {
    return null
  }

  return (
    <Text color={getThemeColor(modeConfig.color, theme)}>
      {modeConfig.icon} {modeConfig.name}
    </Text>
  )
}
