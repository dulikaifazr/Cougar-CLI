import InkLink from 'ink-link'
import { Text } from 'ink'
import React from 'react'
import { env } from '@utils/env'

type LinkProps = {
  url: string
  children?: React.ReactNode
}

// Terminals that support hyperlinks
const LINK_SUPPORTING_TERMINALS = ['iTerm.app', 'WezTerm', 'Hyper', 'VSCode']

export default function Link({ url, children }: LinkProps): React.ReactNode {
  const supportsLinks = LINK_SUPPORTING_TERMINALS.includes(env.terminal ?? '')

  // Determine what text to display - use children or fall back to the URL itself
  const displayContent = children || url

  // Use InkLink to get clickable links when we can, or to get a nice fallback when we can't
  if (supportsLinks || displayContent !== url) {
    return (
      <InkLink url={url}>
        <Text>{displayContent}</Text>
      </InkLink>
    )
  } else {
    // But if we don't have a title and just have a url *and* are not a terminal that supports links
    // that doesn't support clickable links anyway, just show the URL
    return <Text underline>{displayContent}</Text>
  }
}
