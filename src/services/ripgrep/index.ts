import * as childProcess from "child_process"
import * as path from "path"
import * as readline from "readline"
import { promisify } from "util"
import * as fs from "fs"

const execAsync = promisify(childProcess.exec)

/**
 * Ripgrep搜索结果接口
 */
export interface SearchResult {
	filePath: string
	line: number
	column: number
	match: string
	beforeContext: string[]
	afterContext: string[]
}

/**
 * Ripgrep JSON输出接口
 */
interface RipgrepMatch {
	type: "match" | "context"
	data: {
		path: { text: string }
		line_number: number
		lines: { text: string }
		submatches?: Array<{ start: number; end: number }>
	}
}

/**
 * 性能常量
 */
const MAX_RESULTS = 300
const MAX_RIPGREP_MB = 0.25
const MAX_BYTE_SIZE = MAX_RIPGREP_MB * 1024 * 1024

/**
 * 获取ripgrep二进制文件路径
 */
function getRipgrepBinaryPath(): string {
	const platform = process.platform
	const arch = process.arch === "x64" ? "x64" : process.arch
	const binaryName = platform === "win32" ? "rg.exe" : "rg"

	// 映射平台名称到下载的目录名
	let platformDir: string
	if (platform === "win32") {
		platformDir = `win-${arch}`
	} else if (platform === "darwin") {
		platformDir = `darwin-${arch}`
	} else if (platform === "linux") {
		platformDir = `linux-${arch}`
	} else {
		throw new Error(`Unsupported platform: ${platform}`)
	}

	// 优先使用项目根目录的ripgrep-binaries
	// 其次尝试process.cwd()
	const projectRoot = path.resolve(__dirname, "../../..")
	const binaryPath = path.join(projectRoot, "ripgrep-binaries", platformDir, binaryName)

	if (!fs.existsSync(binaryPath)) {
		// 如果项目根路径不存在，尝试process.cwd()
		const cwdBinaryPath = path.join(process.cwd(), "ripgrep-binaries", platformDir, binaryName)
		if (fs.existsSync(cwdBinaryPath)) {
			return cwdBinaryPath
		}

		throw new Error(
			`Ripgrep binary not found at ${binaryPath} or ${cwdBinaryPath}. ` +
			`Please run 'npm run download-ripgrep' to download ripgrep binaries.`
		)
	}

	return binaryPath
}

/**
 * 执行ripgrep命令
 */
async function execRipgrep(args: string[]): Promise<string> {
	const binPath = getRipgrepBinaryPath()

	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(binPath, args)
		// cross-platform alternative to head, which is ripgrep author's recommendation for limiting output.
		const rl = readline.createInterface({
			input: rgProcess.stdout,
			crlfDelay: Infinity, // treat \r\n as a single line break even if it's split across chunks. This ensures consistent behavior across different operating systems.
		})

		let output = ""
		let lineCount = 0
		const maxLines = MAX_RESULTS * 5 // limiting ripgrep output with max lines since there's no other way to limit results. it's okay that we're outputting as json, since we're parsing it line by line and ignore anything that's not part of a match. This assumes each result is at most 5 lines.

		rl.on("line", (line) => {
			if (lineCount < maxLines) {
				output += line + "\n"
				lineCount++
			} else {
				rl.close()
				rgProcess.kill()
			}
		})

		let errorOutput = ""
		rgProcess.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})
		rl.on("close", () => {
			if (errorOutput) {
				reject(new Error(`ripgrep process error: ${errorOutput}`))
			} else {
				resolve(output)
			}
		})
		rgProcess.on("error", (error) => {
			reject(new Error(`ripgrep process error: ${error.message}`))
		})
	})
}

/**
 * 解析ripgrep JSON输出
 */
function parseRipgrepOutput(output: string): SearchResult[] {
	const results: SearchResult[] = []
	let currentResult: Partial<SearchResult> | null = null

	output.split("\n").forEach((line) => {
		if (!line.trim()) return

		try {
			const parsed: RipgrepMatch = JSON.parse(line)

			if (parsed.type === "match") {
				// 保存上一个结果
				if (currentResult) {
					results.push(currentResult as SearchResult)
				}

				// 创建新结果
				currentResult = {
					filePath: parsed.data.path.text,
					line: parsed.data.line_number,
					column: parsed.data.submatches?.[0]?.start || 0,
					match: parsed.data.lines.text,
					beforeContext: [],
					afterContext: [],
				}
			} else if (parsed.type === "context" && currentResult) {
				// 处理上下文
				if (parsed.data.line_number < currentResult.line!) {
					currentResult.beforeContext!.push(parsed.data.lines.text)
				} else {
					currentResult.afterContext!.push(parsed.data.lines.text)
				}
			}
		} catch (error) {
			// 错误容错：记录但不中断处理
			console.error("Error parsing ripgrep output:", error)
		}
	})

	// 保存最后一个结果
	if (currentResult) {
		results.push(currentResult as SearchResult)
	}

	return results
}

/**
 * 格式化搜索结果
 */
function formatResults(results: SearchResult[], cwd: string): string {
	const groupedResults: { [key: string]: SearchResult[] } = {}

	// Group results by file name
	results.slice(0, MAX_RESULTS).forEach((result) => {
		const relativeFilePath = path.relative(cwd, result.filePath)
		if (!groupedResults[relativeFilePath]) {
			groupedResults[relativeFilePath] = []
		}
		groupedResults[relativeFilePath].push(result)
	})

	// Calculate file count
	const fileCount = Object.keys(groupedResults).length

	let output = ""
	if (results.length >= MAX_RESULTS) {
		output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results across ${fileCount} file(s). Use a more specific search if necessary.\n\n`
	} else {
		const resultText = results.length === 1 ? "1 result" : `${results.length.toLocaleString()} results`
		const fileText = fileCount === 1 ? "1 file" : `${fileCount} files`
		output += `Found ${resultText} across ${fileText}.\n`
		output += `Total files with matches: ${fileCount}\n\n`
	}

	// 字节大小控制
	let byteSize = Buffer.byteLength(output, "utf8")
	let wasLimitReached = false

	for (const [filePath, fileResults] of Object.entries(groupedResults)) {
		// Check if adding this file's path would exceed the byte limit
		const filePathString = `${filePath.toPosix()}\n│----\n`
		const filePathBytes = Buffer.byteLength(filePathString, "utf8")

		if (byteSize + filePathBytes >= MAX_BYTE_SIZE) {
			wasLimitReached = true
			break
		}

		output += filePathString
		byteSize += filePathBytes

		for (let resultIndex = 0; resultIndex < fileResults.length; resultIndex++) {
			const result = fileResults[resultIndex]
			const allLines = [...result.beforeContext, result.match, ...result.afterContext]

			// Calculate bytes in all lines for this result
			let resultBytes = 0
			const resultLines: string[] = []

			for (const line of allLines) {
				const trimmedLine = line?.trimEnd() ?? ""
				const lineString = `│${trimmedLine}\n`
				const lineBytes = Buffer.byteLength(lineString, "utf8")

				// Check if adding this line would exceed the byte limit
				if (byteSize + resultBytes + lineBytes >= MAX_BYTE_SIZE) {
					wasLimitReached = true
					break
				}

				resultLines.push(lineString)
				resultBytes += lineBytes
			}

			// If we hit the limit in the middle of processing lines, break out of the result loop
			if (wasLimitReached) {
				break
			}

			// Add all lines for this result to the output
			resultLines.forEach((line) => {
				output += line
			})
			byteSize += resultBytes

			// Add separator between results if needed
			if (resultIndex < fileResults.length - 1) {
				const separatorString = "│----\n"
				const separatorBytes = Buffer.byteLength(separatorString, "utf8")

				if (byteSize + separatorBytes >= MAX_BYTE_SIZE) {
					wasLimitReached = true
					break
				}

				output += separatorString
				byteSize += separatorBytes
			}

			// Check if we've hit the byte limit
			if (byteSize >= MAX_BYTE_SIZE) {
				wasLimitReached = true
				break
			}
		}

		// If we hit the limit, break out of the file loop
		if (wasLimitReached) {
			break
		}

		const closingString = "│----\n\n"
		const closingBytes = Buffer.byteLength(closingString, "utf8")

		if (byteSize + closingBytes >= MAX_BYTE_SIZE) {
			wasLimitReached = true
			break
		}

		output += closingString
		byteSize += closingBytes
	}

	// Add a message if we hit the byte limit
	if (wasLimitReached) {
		const truncationMessage = `\n[Results truncated due to exceeding the ${MAX_RIPGREP_MB}MB size limit. Please use a more specific search pattern.]`
		// Only add the message if it fits within the limit
		if (byteSize + Buffer.byteLength(truncationMessage, "utf8") < MAX_BYTE_SIZE) {
			output += truncationMessage
		}
	}

	return output.trim()
}

/**
 * 主搜索函数
 * @param cwd 当前工作目录
 * @param directoryPath 搜索目录
 * @param regex 正则表达式
 * @param filePattern 文件模式（可选）
 * @returns 格式化的搜索结果
 */
export async function regexSearchFiles(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern?: string
): Promise<string> {
	// 构建ripgrep参数
	const args = [
		"--json",
		"-e",
		regex,
		"--glob",
		filePattern || "*",
		"--context",
		"1",
		directoryPath,
	]

	try {
		// 执行ripgrep
		const output = await execRipgrep(args)

		// 解析结果
		const results = parseRipgrepOutput(output)

		// 格式化输出
		return formatResults(results, cwd)
	} catch (error: any) {
		throw new Error(`Ripgrep search failed: ${error.message}`)
	}
}

/**
 * 检查ripgrep是否可用
 */
export async function checkRipgrepAvailability(): Promise<boolean> {
	try {
		const binPath = getRipgrepBinaryPath()
		return fs.existsSync(binPath)
	} catch {
		return false
	}
}
