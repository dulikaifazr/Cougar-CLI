import TurndownService from 'turndown'

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '_',
  strongDelimiter: '**'
})

// Configure rules to handle common HTML elements
turndownService.addRule('removeScripts', {
  filter: ['script', 'style', 'noscript'],
  replacement: () => ''
})

turndownService.addRule('removeComments', {
  filter: (node) => node.nodeType === 8, // Comment nodes
  replacement: () => ''
})

turndownService.addRule('cleanLinks', {
  filter: 'a',
  replacement: (content, node) => {
    const href = node.getAttribute('href')
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) {
      return content
    }
    return `[${content}](${href})`
  }
})

export function convertHtmlToMarkdown(html: string): string {
  try {
    // Clean up the HTML before conversion
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
      .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

    const markdown = turndownService.turndown(cleanHtml)
    
    // Clean up the resulting markdown
    return markdown
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/^\s+|\s+$/gm, '') // Remove leading/trailing spaces on each line
      .trim()
  } catch (error) {
    throw new Error(`Failed to convert HTML to markdown: ${error instanceof Error ? error.message : String(error)}`)
  }
}