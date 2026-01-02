import * as React from 'react'
import type { Command } from '@commands'
import { ResumeConversation } from '@screens/ResumeConversation'
import { render } from 'ink'
import { CACHE_PATHS, loadLogList } from '@utils/log'

export default {
  type: 'local-jsx',
  name: 'resume',
  description: 'Resume a previous conversation',
  isEnabled: true,
  isHidden: false,
  userFacingName() {
    return 'resume'
  },
  async call(onDone, context) {
    const { commands = [], tools = [], verbose = false } = context.options || {}
    const logs = await loadLogList(CACHE_PATHS.messages())
    render(
      <ResumeConversation
        commands={commands}
        context={{ unmount: onDone }}
        logs={logs}
        tools={tools}
        verbose={verbose}
      />,
    )
    // This return is here for type only
    return null
  },
} satisfies Command
