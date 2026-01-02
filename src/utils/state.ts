import { cwd } from 'process'
import { PersistentShell } from './PersistentShell'

// DO NOT ADD MORE STATE HERE OR BORIS WILL CURSE YOU
const STATE: {
  originalCwd: string
} = {
  originalCwd: cwd(),
}

export async function setCwd(cwd: string): Promise<void> {
  try {
    await PersistentShell.getInstance().setCwd(cwd)
  } catch {
    process.chdir(cwd)
  }
}

export function setOriginalCwd(cwd: string): void {
  STATE.originalCwd = cwd
}

export function getOriginalCwd(): string {
  return STATE.originalCwd
}

export function getCwd(): string {
  try {
    return PersistentShell.getInstance().pwd()
  } catch {
    return process.cwd()
  }
}
