/**
 * Advanced Fuzzy Matching Algorithm
 * 
 * Inspired by:
 * - Chinese Pinyin input methods (Sogou, Baidu)
 * - IDE intelligent completion (VSCode, IntelliJ)
 * - Terminal fuzzy finders (fzf, peco)
 * 
 * Key features:
 * - Hyphen-aware matching (dao → dao-qi-harmony)
 * - Numeric suffix matching (py3 → python3)
 * - Abbreviation matching (dq → dao-qi)
 * - Subsequence matching
 * - Word boundary bonus
 */

export interface MatchResult {
  score: number
  matched: boolean
  algorithm: string
}

export class AdvancedFuzzyMatcher {
  /**
   * Main matching function - combines multiple algorithms
   */
  match(candidate: string, query: string): MatchResult {
    // Normalize inputs
    const text = candidate.toLowerCase()
    const pattern = query.toLowerCase()
    
    // Quick exact match - give HUGE score for exact matches
    if (text === pattern) {
      return { score: 10000, matched: true, algorithm: 'exact' }
    }
    
    // Try all algorithms and combine scores
    const algorithms = [
      this.exactPrefixMatch(text, pattern),
      this.hyphenAwareMatch(text, pattern),
      this.wordBoundaryMatch(text, pattern),
      this.abbreviationMatch(text, pattern),
      this.numericSuffixMatch(text, pattern),
      this.subsequenceMatch(text, pattern),
      this.fuzzySegmentMatch(text, pattern),
    ]
    
    // Get best score
    let bestScore = 0
    let bestAlgorithm = 'none'
    
    for (const result of algorithms) {
      if (result.score > bestScore) {
        bestScore = result.score
        bestAlgorithm = result.algorithm
      }
    }
    
    return {
      score: bestScore,
      matched: bestScore > 10,
      algorithm: bestAlgorithm
    }
  }
  
  /**
   * Exact prefix matching
   */
  private exactPrefixMatch(text: string, pattern: string): { score: number; algorithm: string } {
    if (text.startsWith(pattern)) {
      const coverage = pattern.length / text.length
      // Higher base score for prefix matches to prioritize them
      return { score: 1000 + coverage * 500, algorithm: 'prefix' }
    }
    return { score: 0, algorithm: 'prefix' }
  }
  
  /**
   * Hyphen-aware matching (dao → dao-qi-harmony-designer)
   * Treats hyphens as optional word boundaries
   */
  private hyphenAwareMatch(text: string, pattern: string): { score: number; algorithm: string } {
    // Split by hyphens and try to match
    const words = text.split('-')
    
    // Check if pattern matches the beginning of hyphenated words
    if (words[0].startsWith(pattern)) {
      const coverage = pattern.length / words[0].length
      return { score: 300 + coverage * 100, algorithm: 'hyphen-prefix' }
    }
    
    // Check if pattern matches concatenated words (ignoring hyphens)
    const concatenated = words.join('')
    if (concatenated.startsWith(pattern)) {
      const coverage = pattern.length / concatenated.length
      return { score: 250 + coverage * 100, algorithm: 'hyphen-concat' }
    }
    
    // Check if pattern matches any word start
    for (let i = 0; i < words.length; i++) {
      if (words[i].startsWith(pattern)) {
        return { score: 200 - i * 10, algorithm: 'hyphen-word' }
      }
    }
    
    return { score: 0, algorithm: 'hyphen' }
  }
  
  /**
   * Word boundary matching (dq → dao-qi)
   * Matches characters at word boundaries
   */
  private wordBoundaryMatch(text: string, pattern: string): { score: number; algorithm: string } {
    const words = text.split(/[-_\s]+/)
    let patternIdx = 0
    let score = 0
    let matched = false
    
    for (const word of words) {
      if (patternIdx >= pattern.length) break
      
      if (word[0] === pattern[patternIdx]) {
        score += 50 // Bonus for word boundary match
        patternIdx++
        matched = true
        
        // Try to match more characters in this word
        for (let i = 1; i < word.length && patternIdx < pattern.length; i++) {
          if (word[i] === pattern[patternIdx]) {
            score += 20
            patternIdx++
          }
        }
      }
    }
    
    if (matched && patternIdx === pattern.length) {
      return { score, algorithm: 'word-boundary' }
    }
    
    return { score: 0, algorithm: 'word-boundary' }
  }
  
  /**
   * Abbreviation matching (nde → node, daoqi → dao-qi)
   */
  private abbreviationMatch(text: string, pattern: string): { score: number; algorithm: string } {
    let textIdx = 0
    let patternIdx = 0
    let score = 0
    let lastMatchIdx = -1
    
    while (patternIdx < pattern.length && textIdx < text.length) {
      if (text[textIdx] === pattern[patternIdx]) {
        // Calculate position score
        const gap = lastMatchIdx === -1 ? 0 : textIdx - lastMatchIdx - 1
        
        if (textIdx === 0) {
          score += 50 // First character match
        } else if (lastMatchIdx >= 0 && gap === 0) {
          score += 30 // Consecutive match
        } else if (text[textIdx - 1] === '-' || text[textIdx - 1] === '_') {
          score += 40 // Word boundary match
        } else {
          score += Math.max(5, 20 - gap * 2) // Distance penalty
        }
        
        lastMatchIdx = textIdx
        patternIdx++
      }
      textIdx++
    }
    
    if (patternIdx === pattern.length) {
      // Bonus for compact matches
      const spread = lastMatchIdx / pattern.length
      if (spread <= 3) score += 50
      else if (spread <= 5) score += 30
      
      return { score, algorithm: 'abbreviation' }
    }
    
    return { score: 0, algorithm: 'abbreviation' }
  }
  
  /**
   * Numeric suffix matching (py3 → python3, np18 → node18)
   */
  private numericSuffixMatch(text: string, pattern: string): { score: number; algorithm: string } {
    // Check if pattern has numeric suffix
    const patternMatch = pattern.match(/^(.+?)(\d+)$/)
    if (!patternMatch) return { score: 0, algorithm: 'numeric' }
    
    const [, prefix, suffix] = patternMatch
    
    // Check if text ends with same number
    if (!text.endsWith(suffix)) return { score: 0, algorithm: 'numeric' }
    
    // Check if prefix matches start of text
    const textWithoutSuffix = text.slice(0, -suffix.length)
    if (textWithoutSuffix.startsWith(prefix)) {
      const coverage = prefix.length / textWithoutSuffix.length
      return { score: 200 + coverage * 100, algorithm: 'numeric-suffix' }
    }
    
    // Check abbreviation match for prefix
    const abbrevResult = this.abbreviationMatch(textWithoutSuffix, prefix)
    if (abbrevResult.score > 0) {
      return { score: abbrevResult.score + 50, algorithm: 'numeric-abbrev' }
    }
    
    return { score: 0, algorithm: 'numeric' }
  }
  
  /**
   * Subsequence matching - characters appear in order
   */
  private subsequenceMatch(text: string, pattern: string): { score: number; algorithm: string } {
    let textIdx = 0
    let patternIdx = 0
    let score = 0
    
    while (patternIdx < pattern.length && textIdx < text.length) {
      if (text[textIdx] === pattern[patternIdx]) {
        score += 10
        patternIdx++
      }
      textIdx++
    }
    
    if (patternIdx === pattern.length) {
      // Penalty for spread
      const spread = textIdx / pattern.length
      score = Math.max(10, score - spread * 5)
      return { score, algorithm: 'subsequence' }
    }
    
    return { score: 0, algorithm: 'subsequence' }
  }
  
  /**
   * Fuzzy segment matching (dao → dao-qi-harmony)
   * Matches segments flexibly
   */
  private fuzzySegmentMatch(text: string, pattern: string): { score: number; algorithm: string } {
    // Remove hyphens and underscores for matching
    const cleanText = text.replace(/[-_]/g, '')
    const cleanPattern = pattern.replace(/[-_]/g, '')
    
    // Check if clean pattern is a prefix of clean text
    if (cleanText.startsWith(cleanPattern)) {
      const coverage = cleanPattern.length / cleanText.length
      return { score: 150 + coverage * 100, algorithm: 'fuzzy-segment' }
    }
    
    // Check if pattern appears anywhere in clean text
    const index = cleanText.indexOf(cleanPattern)
    if (index !== -1) {
      const positionPenalty = index * 5
      return { score: Math.max(50, 100 - positionPenalty), algorithm: 'fuzzy-contains' }
    }
    
    return { score: 0, algorithm: 'fuzzy-segment' }
  }
}

// Export singleton instance and helper functions
export const advancedMatcher = new AdvancedFuzzyMatcher()

export function matchAdvanced(candidate: string, query: string): MatchResult {
  return advancedMatcher.match(candidate, query)
}

export function matchManyAdvanced(
  candidates: string[], 
  query: string,
  minScore: number = 10
): Array<{ candidate: string; score: number; algorithm: string }> {
  return candidates
    .map(candidate => {
      const result = advancedMatcher.match(candidate, query)
      return {
        candidate,
        score: result.score,
        algorithm: result.algorithm
      }
    })
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
}