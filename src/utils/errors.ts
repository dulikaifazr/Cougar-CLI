export class MalformedCommandError extends TypeError {}

export class DeprecatedCommandError extends Error {}

export class AbortError extends Error {}

/**
 * Custom error class for configuration file parsing errors
 * Includes the file path and the default configuration that should be used
 */
export class ConfigParseError extends Error {
  filePath: string
  defaultConfig: unknown

  constructor(message: string, filePath: string, defaultConfig: unknown) {
    super(message)
    this.name = 'ConfigParseError'
    this.filePath = filePath
    this.defaultConfig = defaultConfig
  }
}
