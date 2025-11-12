/**
 * API 请求重试逻辑
 * 核心作用：为 API 请求添加自动重试功能，处理速率限制和临时错误
 */

interface RetryOptions {
  maxRetries?: number // 最大重试次数
  baseDelay?: number // 基础延迟（毫秒）
  maxDelay?: number // 最大延迟（毫秒）
  retryAllErrors?: boolean // 是否重试所有错误
}

// 默认选项配置
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1_000,
  maxDelay: 10_000,
  retryAllErrors: false,
}

// 可重试错误类
export class RetriableError extends Error {
  status: number = 429
  retryAfter?: number

  constructor(message: string, retryAfter?: number) {
    super(message)
    this.name = "RetriableError"
    this.retryAfter = retryAfter
  }
}

// 重试装饰器：为异步生成器函数添加自动重试功能
export function withRetry(options: RetryOptions = {}) {
  const { maxRetries, baseDelay, maxDelay, retryAllErrors } = { ...DEFAULT_OPTIONS, ...options }

  return (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value

    descriptor.value = async function* (...args: any[]) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          yield* originalMethod.apply(this, args)
          return
        } catch (error: any) {
          const isRateLimit = error?.status === 429 || error instanceof RetriableError
          const isLastAttempt = attempt === maxRetries - 1

          if ((!isRateLimit && !retryAllErrors) || isLastAttempt) {
            throw error
          }

          // 从响应头获取重试延迟或计算指数退避
          const retryAfter =
            error.headers?.["retry-after"] ||
            error.headers?.["x-ratelimit-reset"] ||
            error.headers?.["ratelimit-reset"] ||
            error.retryAfter

          let delay: number
          if (retryAfter) {
            const retryValue = parseInt(retryAfter, 10)
            if (retryValue > Date.now() / 1000) {
              delay = retryValue * 1000 - Date.now()
            } else {
              delay = retryValue * 1000
            }
          } else {
            delay = Math.min(maxDelay, baseDelay * 2 ** attempt)
          }

          const handlerInstance = this as any
          if (handlerInstance.options?.onRetryAttempt) {
            try {
              await handlerInstance.options.onRetryAttempt(attempt + 1, maxRetries, delay, error)
            } catch (e) {
              console.error("Error in onRetryAttempt callback:", e)
            }
          }

          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    return descriptor
  }
}

