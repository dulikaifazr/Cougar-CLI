import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import {
  PermissionMode,
  PermissionContext as IPermissionContext,
  getNextPermissionMode,
  MODE_CONFIGS,
} from '@cougar-types/PermissionMode'

interface PermissionContextValue {
  permissionContext: IPermissionContext
  currentMode: PermissionMode
  cycleMode: () => void
  setMode: (mode: PermissionMode) => void
  isToolAllowed: (toolName: string) => boolean
  getModeConfig: () => (typeof MODE_CONFIGS)[PermissionMode]
}

const PermissionContext = createContext<PermissionContextValue | undefined>(
  undefined,
)

interface PermissionProviderProps {
  children: ReactNode
  isBypassPermissionsModeAvailable?: boolean
}

export function PermissionProvider({
  children,
  isBypassPermissionsModeAvailable = false,
}: PermissionProviderProps) {
  const [permissionContext, setPermissionContext] =
    useState<IPermissionContext>({
      mode: 'default',
      allowedTools: ['*'],
      allowedPaths: [process.cwd()],
      restrictions: {
        readOnly: false,
        requireConfirmation: true,
        bypassValidation: false,
      },
      metadata: {
        transitionCount: 0,
      },
    })

  const cycleMode = useCallback(() => {
    setPermissionContext(prev => {
      const nextMode = getNextPermissionMode(
        prev.mode,
        isBypassPermissionsModeAvailable,
      )
      const modeConfig = MODE_CONFIGS[nextMode]

      console.log(`🔄 Mode cycle: ${prev.mode} → ${nextMode}`)

      return {
        ...prev,
        mode: nextMode,
        allowedTools: modeConfig.allowedTools,
        restrictions: modeConfig.restrictions,
        metadata: {
          ...prev.metadata,
          previousMode: prev.mode,
          activatedAt: new Date().toISOString(),
          transitionCount: prev.metadata.transitionCount + 1,
        },
      }
    })
  }, [isBypassPermissionsModeAvailable])

  const setMode = useCallback((mode: PermissionMode) => {
    setPermissionContext(prev => {
      const modeConfig = MODE_CONFIGS[mode]

      return {
        ...prev,
        mode,
        allowedTools: modeConfig.allowedTools,
        restrictions: modeConfig.restrictions,
        metadata: {
          ...prev.metadata,
          previousMode: prev.mode,
          activatedAt: new Date().toISOString(),
          transitionCount: prev.metadata.transitionCount + 1,
        },
      }
    })
  }, [])

  const isToolAllowed = useCallback(
    (toolName: string) => {
      const { allowedTools } = permissionContext

      // If '*' is in allowed tools, all tools are allowed
      if (allowedTools.includes('*')) {
        return true
      }

      // Check if specific tool is in allowed list
      return allowedTools.includes(toolName)
    },
    [permissionContext],
  )

  const getModeConfig = useCallback(() => {
    return MODE_CONFIGS[permissionContext.mode]
  }, [permissionContext.mode])

  const value: PermissionContextValue = {
    permissionContext,
    currentMode: permissionContext.mode,
    cycleMode,
    setMode,
    isToolAllowed,
    getModeConfig,
  }

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissionContext(): PermissionContextValue {
  const context = useContext(PermissionContext)
  if (context === undefined) {
    throw new Error(
      'usePermissionContext must be used within a PermissionProvider',
    )
  }
  return context
}

// Hook for components that need to respond to permission mode changes
export function usePermissionMode(): [
  PermissionMode,
  (mode: PermissionMode) => void,
  () => void,
] {
  const { currentMode, setMode, cycleMode } = usePermissionContext()
  return [currentMode, setMode, cycleMode]
}
