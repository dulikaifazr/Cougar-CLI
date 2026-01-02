import { Box, Text } from 'ink'
import * as React from 'react'

type Props = {
  children: React.ReactNode
}

export function MessageResponse({ children }: Props): React.ReactNode {
  return (
    <Box flexDirection="row" height={1} overflow="hidden">
      <Text>{'  '}⎿ &nbsp;</Text>
      {children}
    </Box>
  )
}
