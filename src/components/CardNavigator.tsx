import React, { useState, useRef, ReactNode, createContext, useContext } from 'react'
import { useInput } from 'ink'

// Navigation context for sharing state between parent and children
interface NavigationContextType {
  pushCard: (card: CardContent) => void
  popCard: () => boolean
  replaceCard: (card: CardContent) => void
  currentDepth: number
}

const NavigationContext = createContext<NavigationContextType | null>(null)

export function useCardNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useCardNavigation must be used within CardNavigator')
  }
  return context
}

// Card content type
export interface CardContent {
  id: string
  content: ReactNode
}

interface CardNavigatorProps {
  onExit?: () => void // Called when Esc is pressed at root level
  children: ReactNode // Initial content
}

/**
 * Universal card navigator that handles multi-level navigation
 * Automatically intercepts Esc key to navigate back through card stack
 */
export function CardNavigator({ onExit, children }: CardNavigatorProps) {
  const [cardStack, setCardStack] = useState<CardContent[]>([])
  const escapeHandledRef = useRef(false)

  // Push a new card onto the stack
  const pushCard = (card: CardContent) => {
    setCardStack(prev => [...prev, card])
  }

  // Pop the top card from the stack
  const popCard = (): boolean => {
    if (cardStack.length > 0) {
      setCardStack(prev => prev.slice(0, -1))
      return true
    }
    return false
  }

  // Replace the current card
  const replaceCard = (card: CardContent) => {
    if (cardStack.length > 0) {
      setCardStack(prev => [...prev.slice(0, -1), card])
    } else {
      setCardStack([card])
    }
  }

  // Global Escape key handler
  useInput(
    (input, key) => {
      if (key.escape && !escapeHandledRef.current) {
        escapeHandledRef.current = true

        // Reset handled flag after a short delay
        setTimeout(() => {
          escapeHandledRef.current = false
        }, 100)

        // Try to pop a card
        const popped = popCard()

        // If we couldn't pop (we're at root) and onExit is defined
        if (!popped && onExit) {
          onExit()
        }
      }
    },
    { isActive: true }
  )

  const contextValue: NavigationContextType = {
    pushCard,
    popCard,
    replaceCard,
    currentDepth: cardStack.length
  }

  // Show the top card if there is one, otherwise show children
  const currentCard = cardStack[cardStack.length - 1]

  return (
    <NavigationContext.Provider value={contextValue}>
      {currentCard ? currentCard.content : children}
    </NavigationContext.Provider>
  )
}