import React, { useEffect, useState, useMemo } from 'react'
import { Text } from 'ink'
import { getAgentByType } from '@utils/agentLoader'
import { getTheme } from '@utils/theme'

interface Props {
  agentType: string
  children: React.ReactNode
  bold?: boolean
}

// Simple cache to prevent re-fetching agent configs
const agentConfigCache = new Map<string, any>()

export function TaskToolMessage({ agentType, children, bold = true }: Props) {
  const theme = getTheme()
  const [agentConfig, setAgentConfig] = useState<any>(() => {
    // Return cached config immediately if available
    return agentConfigCache.get(agentType) || null
  })

  useEffect(() => {
    // Skip if already cached
    if (agentConfigCache.has(agentType)) {
      setAgentConfig(agentConfigCache.get(agentType))
      return
    }

    // Load and cache agent configuration
    let mounted = true
    getAgentByType(agentType).then(config => {
      if (mounted) {
        agentConfigCache.set(agentType, config)
        setAgentConfig(config)
      }
    }).catch(() => {
      // Silently handle errors to prevent console noise
      if (mounted) {
        agentConfigCache.set(agentType, null)
      }
    })

    return () => {
      mounted = false
    }
  }, [agentType])

  // Memoize color calculation to prevent unnecessary re-renders
  const color = useMemo(() => {
    return agentConfig?.color || theme.text
  }, [agentConfig?.color, theme.text])

  return (
    <Text color={color} bold={bold}>
      {children}
    </Text>
  )
}