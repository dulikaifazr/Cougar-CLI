import React from 'react'
import { render } from 'ink'
import { ModelConfig } from '@components/ModelConfig'
import { enableConfigs } from '@utils/config'
import { triggerModelConfigChange } from '@messages'

export const help = 'Change your AI provider and model settings'
export const description = 'Change your AI provider and model settings'
export const isEnabled = true
export const isHidden = false
export const name = 'model'
export const type = 'local-jsx'

export function userFacingName(): string {
  return name
}

export async function call(
  onDone: (result?: string) => void,
  context: any,
): Promise<React.ReactNode> {
  const { abortController } = context
  enableConfigs()
  abortController?.abort?.()
  return (
    <ModelConfig
      onClose={() => {
        // Force ModelManager reload to ensure UI sync - wait for completion before closing
        import('@utils/model').then(({ reloadModelManager }) => {
          reloadModelManager()
          // 🔧 Critical fix: Trigger global UI refresh after model config changes
          // This ensures PromptInput component detects ModelManager singleton state changes
          triggerModelConfigChange()
          // Only close after reload is complete to ensure UI synchronization
          onDone()
        })
      }}
    />
  )
}
