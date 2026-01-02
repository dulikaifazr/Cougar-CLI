/**
 * Input Method Inspired Fuzzy Matching Algorithm
 * 
 * Multi-algorithm weighted scoring system inspired by:
 * - Sogou/Baidu Pinyin input method algorithms
 * - Double-pinyin abbreviation matching
 * - Terminal completion best practices (fzf, zsh, fish)
 * 
 * Designed specifically for command/terminal completion scenarios
 * where users type abbreviations like "nde" expecting "node"
 */

export interface MatchResult {
  score: number
  algorithm: string  // Which algorithm contributed most to the score
  confidence: number // 0-1 confidence level
}

export interface FuzzyMatcherConfig {
  // Algorithm weights (must sum to 1.0)
  weights: {
    prefix: number      // Direct prefix matching ("nod" → "node")
    substring: number   // Substring matching ("ode" → "node") 
    abbreviation: number // Key chars matching ("nde" → "node")
    editDistance: number // Typo tolerance ("noda" → "node")
    popularity: number  // Common command boost
  }
  
  // Scoring parameters
  minScore: number           // Minimum score threshold
  maxEditDistance: number    // Maximum edits allowed
  popularCommands: string[]  // Commands to boost
}

const DEFAULT_CONFIG: FuzzyMatcherConfig = {
  weights: {
    prefix: 0.35,       // Strong weight for prefix matching
    substring: 0.20,    // Good for partial matches  
    abbreviation: 0.30, // Key for "nde"→"node" cases
    editDistance: 0.10, // Typo tolerance
    popularity: 0.05    // Slight bias for common commands
  },
  minScore: 10,  // Lower threshold for better matching
  maxEditDistance: 2,
  popularCommands: [
    'node', 'npm', 'git', 'ls', 'cd', 'cat', 'grep', 'find', 'cp', 'mv',
    'python', 'java', 'docker', 'curl', 'wget', 'vim', 'nano'
  ]
}

export class FuzzyMatcher {
  private config: FuzzyMatcherConfig

  constructor(config: Partial<FuzzyMatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // Normalize weights to sum to 1.0
    const weightSum = Object.values(this.config.weights).reduce((a, b) => a + b, 0)
    if (Math.abs(weightSum - 1.0) > 0.01) {
      Object.keys(this.config.weights).forEach(key => {
        this.config.weights[key as keyof typeof this.config.weights] /= weightSum
      })
    }
  }

  /**
   * Calculate fuzzy match score for a candidate against a query
   */
  match(candidate: string, query: string): MatchResult {
    const text = candidate.toLowerCase()
    const pattern = query.toLowerCase()

    // Quick perfect match exits
    if (text === pattern) {
      return { score: 1000, algorithm: 'exact', confidence: 1.0 }
    }
    if (text.startsWith(pattern)) {
      return { 
        score: 900 + (10 - pattern.length), 
        algorithm: 'prefix-exact', 
        confidence: 0.95 
      }
    }

    // Run all algorithms
    const scores = {
      prefix: this.prefixScore(text, pattern),
      substring: this.substringScore(text, pattern), 
      abbreviation: this.abbreviationScore(text, pattern),
      editDistance: this.editDistanceScore(text, pattern),
      popularity: this.popularityScore(text)
    }

    // Weighted combination
    const rawScore = Object.entries(scores).reduce((total, [algorithm, score]) => {
      const weight = this.config.weights[algorithm as keyof typeof this.config.weights]
      return total + (score * weight)
    }, 0)

    // Length penalty (prefer shorter commands)
    const lengthPenalty = Math.max(0, text.length - 6) * 1.5
    const finalScore = Math.max(0, rawScore - lengthPenalty)

    // Determine primary algorithm and confidence
    const maxAlgorithm = Object.entries(scores).reduce((max, [alg, score]) => 
      score > max.score ? { algorithm: alg, score } : max, 
      { algorithm: 'none', score: 0 }
    )

    const confidence = Math.min(1.0, finalScore / 100)

    return {
      score: finalScore,
      algorithm: maxAlgorithm.algorithm,
      confidence
    }
  }

  /**
   * Algorithm 1: Prefix Matching (like pinyin prefix)
   * Handles cases like "nod" → "node"
   */
  private prefixScore(text: string, pattern: string): number {
    if (!text.startsWith(pattern)) return 0
    
    // Score based on prefix length vs total length
    const coverage = pattern.length / text.length
    return 100 * coverage
  }

  /**
   * Algorithm 2: Substring Matching (like pinyin contains)  
   * Handles cases like "ode" → "node", "py3" → "python3"
   */
  private substringScore(text: string, pattern: string): number {
    // Direct substring match
    const index = text.indexOf(pattern)
    if (index !== -1) {
      // Earlier position and better coverage = higher score
      const positionFactor = Math.max(0, 10 - index) / 10
      const coverageFactor = pattern.length / text.length
      return 80 * positionFactor * coverageFactor
    }
    
    // Special handling for numeric suffixes (py3 → python3)
    // Check if pattern ends with a number and try prefix match + number
    const numMatch = pattern.match(/^(.+?)(\d+)$/)
    if (numMatch) {
      const [, prefix, num] = numMatch
      // Check if text starts with prefix and ends with the same number
      if (text.startsWith(prefix) && text.endsWith(num)) {
        // Good match for patterns like "py3" → "python3"
        const coverageFactor = pattern.length / text.length
        return 70 * coverageFactor + 20 // Bonus for numeric suffix match
      }
    }
    
    return 0
  }

  /**
   * Algorithm 3: Abbreviation Matching (key innovation)
   * Handles cases like "nde" → "node", "pyt3" → "python3", "gp5" → "gpt-5"
   */
  private abbreviationScore(text: string, pattern: string): number {
    let score = 0
    let textPos = 0
    let perfectStart = false
    let consecutiveMatches = 0
    let wordBoundaryMatches = 0
    
    // Split text by hyphens to handle word boundaries better
    const textWords = text.split('-')
    const textClean = text.replace(/-/g, '').toLowerCase()
    
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i]
      let charFound = false
      
      // Try to find in clean text (no hyphens)
      for (let j = textPos; j < textClean.length; j++) {
        if (textClean[j] === char) {
          charFound = true
          
          // Check if this character is at a word boundary in original text
          let originalPos = 0
          let cleanPos = 0
          for (let k = 0; k < text.length; k++) {
            if (text[k] === '-') continue
            if (cleanPos === j) {
              originalPos = k
              break
            }
            cleanPos++
          }
          
          // Consecutive character bonus
          if (j === textPos) {
            consecutiveMatches++
          } else {
            consecutiveMatches = 1
          }
          
          // Position-sensitive scoring
          if (i === 0 && j === 0) {
            score += 50  // Perfect first character
            perfectStart = true
          } else if (originalPos === 0 || text[originalPos - 1] === '-') {
            score += 35  // Word boundary match
            wordBoundaryMatches++
          } else if (j <= 2) {
            score += 20  // Early position
          } else if (j <= 6) {
            score += 10  // Mid position  
          } else {
            score += 5   // Late position
          }
          
          // Consecutive character bonus
          if (consecutiveMatches > 1) {
            score += consecutiveMatches * 5
          }
          
          textPos = j + 1
          break
        }
      }
      
      if (!charFound) return 0 // Invalid abbreviation
    }
    
    // Critical bonuses
    if (perfectStart) score += 30
    if (wordBoundaryMatches >= 2) score += 25  // Multiple word boundaries
    if (textPos <= textClean.length * 0.8) score += 15  // Compact abbreviation
    
    // Special bonus for number matching at end
    const lastPatternChar = pattern[pattern.length - 1]
    const lastTextChar = text[text.length - 1]
    if (/\d/.test(lastPatternChar) && lastPatternChar === lastTextChar) {
      score += 25
    }
    
    return score
  }

  /**
   * Algorithm 4: Edit Distance (typo tolerance)
   * Handles cases like "noda" → "node"
   */
  private editDistanceScore(text: string, pattern: string): number {
    if (pattern.length > text.length + this.config.maxEditDistance) return 0
    
    // Simplified Levenshtein distance  
    const dp: number[][] = []
    const m = pattern.length
    const n = text.length
    
    // Initialize DP table
    for (let i = 0; i <= m; i++) {
      dp[i] = []
      for (let j = 0; j <= n; j++) {
        if (i === 0) dp[i][j] = j
        else if (j === 0) dp[i][j] = i
        else {
          const cost = pattern[i-1] === text[j-1] ? 0 : 1
          dp[i][j] = Math.min(
            dp[i-1][j] + 1,     // deletion
            dp[i][j-1] + 1,     // insertion
            dp[i-1][j-1] + cost // substitution
          )
        }
      }
    }
    
    const distance = dp[m][n]
    if (distance > this.config.maxEditDistance) return 0
    
    return Math.max(0, 30 - distance * 10)
  }

  /**
   * Algorithm 5: Command Popularity (like frequency in input method)
   * Boost common commands that users frequently type
   */
  private popularityScore(text: string): number {
    if (this.config.popularCommands.includes(text)) {
      return 40
    }
    
    // Short commands are often more commonly used
    if (text.length <= 5) return 10
    
    return 0
  }

  /**
   * Batch match multiple candidates and return sorted results
   */
  matchMany(candidates: string[], query: string): Array<{candidate: string, result: MatchResult}> {
    return candidates
      .map(candidate => ({ 
        candidate, 
        result: this.match(candidate, query) 
      }))
      .filter(item => item.result.score >= this.config.minScore)
      .sort((a, b) => b.result.score - a.result.score)
  }
}

// Export convenience functions
export const defaultMatcher = new FuzzyMatcher()

export function matchCommand(command: string, query: string): MatchResult {
  return defaultMatcher.match(command, query)
}

// Import the advanced matcher
import { matchManyAdvanced } from './advancedFuzzyMatcher'

export function matchCommands(commands: string[], query: string): Array<{command: string, score: number}> {
  // Use the advanced matcher for better results
  return matchManyAdvanced(commands, query, 5) // Lower threshold for better matching
    .map(item => ({ 
      command: item.candidate, 
      score: item.score 
    }))
}