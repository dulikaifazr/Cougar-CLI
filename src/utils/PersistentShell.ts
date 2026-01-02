import * as fs from 'fs'
import { homedir } from 'os'
import { existsSync } from 'fs'
import shellquote from 'shell-quote'
import { spawn, execSync, execFileSync, type ChildProcess } from 'child_process'
import { isAbsolute, resolve, join } from 'path'
import { logError } from './log'
import * as os from 'os'
import { PRODUCT_COMMAND } from '@constants/product'

type ExecResult = {
  stdout: string
  stderr: string
  code: number
  interrupted: boolean
}
type QueuedCommand = {
  command: string
  abortSignal?: AbortSignal
  timeout?: number
  resolve: (result: ExecResult) => void
  reject: (error: Error) => void
}

const TEMPFILE_PREFIX = os.tmpdir() + `/${PRODUCT_COMMAND}-`
const DEFAULT_TIMEOUT = 30 * 60 * 1000
const SIGTERM_CODE = 143 // Standard exit code for SIGTERM
const FILE_SUFFIXES = {
  STATUS: '-status',
  STDOUT: '-stdout',
  STDERR: '-stderr',
  CWD: '-cwd',
}
const SHELL_CONFIGS: Record<string, string> = {
  '/bin/bash': '.bashrc',
  '/bin/zsh': '.zshrc',
}

type DetectedShell = {
  bin: string
  args: string[]
  type: 'posix' | 'msys' | 'wsl'
}

function quoteForBash(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`
}

function toBashPath(pathStr: string, type: 'posix' | 'msys' | 'wsl'): string {
  // Already POSIX absolute path
  if (pathStr.startsWith('/')) return pathStr
  if (type === 'posix') return pathStr

  // Normalize backslashes
  const normalized = pathStr.replace(/\\/g, '/').replace(/\\\\/g, '/')
  const driveMatch = /^[A-Za-z]:/.exec(normalized)
  if (driveMatch) {
    const drive = normalized[0].toLowerCase()
    const rest = normalized.slice(2)
    if (type === 'msys') {
      return `/` + drive + (rest.startsWith('/') ? rest : `/${rest}`)
    }
    // wsl
    return `/mnt/` + drive + (rest.startsWith('/') ? rest : `/${rest}`)
  }
  // Relative path: just convert slashes
  return normalized
}

function fileExists(p: string | undefined): p is string {
  return !!p && existsSync(p)
}

// Robust PATH splitter for Windows and POSIX
function splitPathEntries(pathEnv: string, platform: NodeJS.Platform): string[] {
  if (!pathEnv) return []

  // POSIX: ':' is the separator
  if (platform !== 'win32') {
    return pathEnv
      .split(':')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)
  }

  // Windows: primarily ';', but some environments may use ':'
  // We must not split drive letters like 'C:\\' or 'D:foo\\bar'
  const entries: string[] = []
  let current = ''
  const pushCurrent = () => {
    const cleaned = current.trim().replace(/^"|"$/g, '')
    if (cleaned) entries.push(cleaned)
    current = ''
  }

  for (let i = 0; i < pathEnv.length; i++) {
    const ch = pathEnv[i]

    if (ch === ';') {
      pushCurrent()
      continue
    }

    if (ch === ':') {
      const segmentLength = current.length
      const firstChar = current[0]
      const isDriveLetterPrefix = segmentLength === 1 && /[A-Za-z]/.test(firstChar || '')
      // Treat ':' as separator only if it's NOT the drive letter colon
      if (!isDriveLetterPrefix) {
        pushCurrent()
        continue
      }
    }

    current += ch
  }

  // Flush the final segment
  pushCurrent()

  return entries
}

function detectShell(): DetectedShell {
  const isWin = process.platform === 'win32'
  if (!isWin) {
    const bin = process.env.SHELL || '/bin/bash'
    return { bin, args: ['-l'], type: 'posix' }
  }

  // 1) Respect SHELL if it points to a bash.exe that exists
  if (process.env.SHELL && /bash\.exe$/i.test(process.env.SHELL) && existsSync(process.env.SHELL)) {
    return { bin: process.env.SHELL, args: [], type: 'msys' }
  }

  // 1.1) Explicit override
  if (process.env.COUGAR_BASH && existsSync(process.env.COUGAR_BASH)) {
    return { bin: process.env.COUGAR_BASH, args: [], type: 'msys' }
  }

  // 2) Common Git Bash/MSYS2 locations
  const programFiles = [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    process.env['ProgramW6432'],
  ].filter(Boolean) as string[]

  const localAppData = process.env['LocalAppData']

  const candidates: string[] = []
  for (const base of programFiles) {
    candidates.push(
      join(base, 'Git', 'bin', 'bash.exe'),
      join(base, 'Git', 'usr', 'bin', 'bash.exe'),
    )
  }
  if (localAppData) {
    candidates.push(
      join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'),
      join(localAppData, 'Programs', 'Git', 'usr', 'bin', 'bash.exe'),
    )
  }
  // MSYS2 default
  candidates.push('C:/msys64/usr/bin/bash.exe')

  for (const c of candidates) {
    if (existsSync(c)) {
      return { bin: c, args: [], type: 'msys' }
    }
  }

  // 2.1) Search in PATH for bash.exe
  const pathEnv = process.env.PATH || process.env.Path || process.env.path || ''
  const pathEntries = splitPathEntries(pathEnv, process.platform)
  for (const p of pathEntries) {
    const candidate = join(p, 'bash.exe')
    if (existsSync(candidate)) {
      return { bin: candidate, args: [], type: 'msys' }
    }
  }

  // 3) WSL
  try {
    // Quick probe to ensure WSL+bash exists
    execSync('wsl.exe -e bash -lc "echo COUGAR_OK"', { stdio: 'ignore', timeout: 1500 })
    return { bin: 'wsl.exe', args: ['-e', 'bash', '-l'], type: 'wsl' }
  } catch {}

  // 4) Last resort: meaningful error
  const hint = [
    '无法找到可用的 bash。请安装 Git for Windows 或启用 WSL。',
    '推荐安装 Git: https://git-scm.com/download/win',
    '或启用 WSL 并安装 Ubuntu: https://learn.microsoft.com/windows/wsl/install',
  ].join('\n')
  throw new Error(hint)
}

export class PersistentShell {
  private commandQueue: QueuedCommand[] = []
  private isExecuting: boolean = false
  private shell: ChildProcess
  private isAlive: boolean = true
  private commandInterrupted: boolean = false
  private statusFile: string
  private stdoutFile: string
  private stderrFile: string
  private cwdFile: string
  private cwd: string
  private binShell: string
  private shellArgs: string[]
  private shellType: 'posix' | 'msys' | 'wsl'
  private statusFileBashPath: string
  private stdoutFileBashPath: string
  private stderrFileBashPath: string
  private cwdFileBashPath: string

  constructor(cwd: string) {
    const { bin, args, type } = detectShell()
    this.binShell = bin
    this.shellArgs = args
    this.shellType = type

    this.shell = spawn(this.binShell, this.shellArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: {
        ...process.env,
        GIT_EDITOR: 'true',
      },
    })

    this.cwd = cwd

    this.shell.on('exit', (code, signal) => {
      if (code) {
        // TODO: It would be nice to alert the user that shell crashed
        logError(`Shell exited with code ${code} and signal ${signal}`)
      }
      for (const file of [
        this.statusFile,
        this.stdoutFile,
        this.stderrFile,
        this.cwdFile,
      ]) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file)
        }
      }
      this.isAlive = false
    })

    const id = Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0')

    this.statusFile = TEMPFILE_PREFIX + id + FILE_SUFFIXES.STATUS
    this.stdoutFile = TEMPFILE_PREFIX + id + FILE_SUFFIXES.STDOUT
    this.stderrFile = TEMPFILE_PREFIX + id + FILE_SUFFIXES.STDERR
    this.cwdFile = TEMPFILE_PREFIX + id + FILE_SUFFIXES.CWD
    for (const file of [this.statusFile, this.stdoutFile, this.stderrFile]) {
      fs.writeFileSync(file, '')
    }
    // Initialize CWD file with initial directory
    fs.writeFileSync(this.cwdFile, cwd)

    // Compute bash-visible paths for redirections
    this.statusFileBashPath = toBashPath(this.statusFile, this.shellType)
    this.stdoutFileBashPath = toBashPath(this.stdoutFile, this.shellType)
    this.stderrFileBashPath = toBashPath(this.stderrFile, this.shellType)
    this.cwdFileBashPath = toBashPath(this.cwdFile, this.shellType)

    // Source ~/.bashrc when available (avoid login shells on MSYS to prevent cwd resets)
    if (this.shellType === 'msys') {
      // Use non-login shell; explicitly source but keep working directory
      this.sendToShell('[ -f ~/.bashrc ] && source ~/.bashrc || true')
      // Ensure CWD file reflects current Windows path immediately on MSYS
      this.sendToShell(`pwd -W > ${quoteForBash(this.cwdFileBashPath)}`)
    } else {
      this.sendToShell('[ -f ~/.bashrc ] && source ~/.bashrc || true')
    }
  }

  private static instance: PersistentShell | null = null

  static closeIfInitialized(): void {
    try {
      PersistentShell.instance?.close()
    } catch {
    }
  }

  static restart() {
    if (PersistentShell.instance) {
      PersistentShell.instance.close()
      PersistentShell.instance = null
    }
  }

  static getInstance(): PersistentShell {
    if (!PersistentShell.instance || !PersistentShell.instance.isAlive) {
      PersistentShell.instance = new PersistentShell(process.cwd())
    }
    return PersistentShell.instance
  }

  killChildren() {
    const parentPid = this.shell.pid
    try {
      const childPids = execSync(`pgrep -P ${parentPid}`)
        .toString()
        .trim()
        .split('\n')
        .filter(Boolean) // Filter out empty strings

      

      childPids.forEach(pid => {
        try {
          process.kill(Number(pid), 'SIGTERM')
        } catch (error) {
          logError(`Failed to kill process ${pid}: ${error}`)
        }
      })
    } catch {
      // pgrep returns non-zero when no processes are found - this is expected
    } finally {
      this.commandInterrupted = true
    }
  }

  private async processQueue() {
    /**
     * Processes commands from the queue one at a time.
     * Concurrency invariants:
     * - Only one instance runs at a time (controlled by isExecuting)
     * - Is the only caller of updateCwd() in the system
     * - Calls updateCwd() after each command completes
     * - Ensures commands execute serially via the queue
     * - Handles interruption via abortSignal by calling killChildren()
     * - Cleans up abortSignal listeners after command completion or interruption
     */
    if (this.isExecuting || this.commandQueue.length === 0) return

    this.isExecuting = true
    const { command, abortSignal, timeout, resolve, reject } =
      this.commandQueue.shift()!

    const killChildren = () => this.killChildren()
    if (abortSignal) {
      abortSignal.addEventListener('abort', killChildren)
    }

    try {
      const result = await this.exec_(command, timeout)

      // No need to update cwd - it's handled in exec_ via the CWD file

      resolve(result)
    } catch (error) {
      
      reject(error as Error)
    } finally {
      this.isExecuting = false
      if (abortSignal) {
        abortSignal.removeEventListener('abort', killChildren)
      }
      // Process next command in queue
      this.processQueue()
    }
  }

  async exec(
    command: string,
    abortSignal?: AbortSignal,
    timeout?: number,
  ): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, abortSignal, timeout, resolve, reject })
      this.processQueue()
    })
  }

  private async exec_(command: string, timeout?: number): Promise<ExecResult> {
    /**
     * Direct command execution without going through the queue.
     * Concurrency invariants:
     * - Not safe for concurrent calls (uses shared files)
     * - Called only when queue is idle
     * - Relies on file-based IPC to handle shell interaction
     * - Does not modify the command queue state
     * - Tracks interruption state via commandInterrupted flag
     * - Resets interruption state at start of new command
     * - Reports interruption status in result object
     *
     * Exit Code & CWD Handling:
     * - Executes command and immediately captures its exit code into a shell variable
     * - Updates the CWD file with the working directory after capturing exit code
     * - Writes the preserved exit code to the status file as the final step
     * - This sequence eliminates race conditions between exit code capture and CWD updates
     * - The pwd() method reads the CWD file directly for current directory info
     */
    const quotedCommand = quoteForBash(command)

    // Check the syntax of the command
    try {
      if (this.shellType === 'wsl') {
        // On Windows WSL, avoid shell string quoting issues by using argv form
        execFileSync('wsl.exe', ['-e', 'bash', '-n', '-c', command], {
          stdio: 'ignore',
          timeout: 1000,
        })
      } else if (this.shellType === 'msys') {
        // On Windows Git Bash/MSYS, use execFileSync to bypass cmd.exe parsing
        execFileSync(this.binShell, ['-n', '-c', command], {
          stdio: 'ignore',
          timeout: 1000,
        })
      } else {
        // POSIX platforms: keep existing behavior
        execSync(`${this.binShell} -n -c ${quotedCommand}`, {
          stdio: 'ignore',
          timeout: 1000,
        })
      }
    } catch (error) {
      // If there's a syntax error, return an error with the actual exit code
      const execError = error as any
      const actualExitCode = execError?.status ?? execError?.code ?? 2 // Default to 2 (syntax error) if no code available
      const errorStr = execError?.stderr?.toString() || execError?.message || String(error || '')
      
      return Promise.resolve({
        stdout: '',
        stderr: errorStr,
        code: actualExitCode,
        interrupted: false,
      })
    }

    const commandTimeout = timeout || DEFAULT_TIMEOUT
    // Reset interrupted state for new command
    this.commandInterrupted = false
    return new Promise<ExecResult>(resolve => {
      // Truncate output files
      fs.writeFileSync(this.stdoutFile, '')
      fs.writeFileSync(this.stderrFile, '')
      fs.writeFileSync(this.statusFile, '')
      // Break up the command sequence for clarity using an array of commands
      const commandParts = []

      // 1. Execute the main command with redirections
      commandParts.push(
        `eval ${quotedCommand} < /dev/null > ${quoteForBash(this.stdoutFileBashPath)} 2> ${quoteForBash(this.stderrFileBashPath)}`,
      )

      // 2. Capture exit code immediately after command execution to avoid losing it
      commandParts.push(`EXEC_EXIT_CODE=$?`)

      // 3. Update CWD file (use Windows path on MSYS to keep Node path checks correct)
      if (this.shellType === 'msys') {
        commandParts.push(`pwd -W > ${quoteForBash(this.cwdFileBashPath)}`)
      } else {
        commandParts.push(`pwd > ${quoteForBash(this.cwdFileBashPath)}`)
      }

      // 4. Write the preserved exit code to status file to avoid race with pwd
      commandParts.push(`echo $EXEC_EXIT_CODE > ${quoteForBash(this.statusFileBashPath)}`)

      // Send the combined commands as a single operation to maintain atomicity
      this.sendToShell(commandParts.join('\n'))

      // Check for command completion or timeout
      const start = Date.now()
      const checkCompletion = setInterval(() => {
        try {
          let statusFileSize = 0
          if (fs.existsSync(this.statusFile)) {
            statusFileSize = fs.statSync(this.statusFile).size
          }

          if (
            statusFileSize > 0 ||
            Date.now() - start > commandTimeout ||
            this.commandInterrupted
          ) {
            clearInterval(checkCompletion)
            const stdout = fs.existsSync(this.stdoutFile)
              ? fs.readFileSync(this.stdoutFile, 'utf8')
              : ''
            let stderr = fs.existsSync(this.stderrFile)
              ? fs.readFileSync(this.stderrFile, 'utf8')
              : ''
            let code: number
            if (statusFileSize) {
              code = Number(fs.readFileSync(this.statusFile, 'utf8'))
            } else {
              // Timeout occurred - kill any running processes
              this.killChildren()
              code = SIGTERM_CODE
              stderr += (stderr ? '\n' : '') + 'Command execution timed out'
              
            }
            resolve({
              stdout,
              stderr,
              code,
              interrupted: this.commandInterrupted,
            })
          }
        } catch {
          // Ignore file system errors during polling - they are expected
          // as we check for completion before files exist
        }
      }, 10) // increasing this will introduce latency
    })
  }

  private sendToShell(command: string) {
    try {
      this.shell!.stdin!.write(command + '\n')
    } catch (error) {
      const errorString =
        error instanceof Error
          ? error.message
          : String(error || 'Unknown error')
      logError(`Error in sendToShell: ${errorString}`)
      
      throw error
    }
  }

  pwd(): string {
    try {
      const newCwd = fs.readFileSync(this.cwdFile, 'utf8').trim()
      if (newCwd) {
        this.cwd = newCwd
      }
    } catch (error) {
      logError(`Shell pwd error ${error}`)
    }
    // Always return the cached value
    return this.cwd
  }

  async setCwd(cwd: string) {
    const resolved = isAbsolute(cwd) ? cwd : resolve(process.cwd(), cwd)
    if (!existsSync(resolved)) {
      throw new Error(`Path "${resolved}" does not exist`)
    }
    const bashPath = toBashPath(resolved, this.shellType)
    await this.exec(`cd ${quoteForBash(bashPath)}`)
  }

  close(): void {
    this.shell!.stdin!.end()
    this.shell.kill()
  }
}
