/**
 * 进度指示器工具
 * 用于显示长时间操作的进度
 */

/**
 * 简单的旋转动画
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private currentFrame = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private message: string;

  constructor(message: string = '加载中...') {
    this.message = message;
  }

  start(): void {
    if (this.intervalId) return;

    // 隐藏光标
    process.stdout.write('\x1B[?25l');

    this.intervalId = setInterval(() => {
      const frame = this.frames[this.currentFrame];
      process.stdout.write(`\r${frame} ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  update(message: string): void {
    this.message = message;
  }

  stop(finalMessage?: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // 清除当前行
    process.stdout.write('\r\x1B[K');

    if (finalMessage) {
      console.log(finalMessage);
    }

    // 显示光标
    process.stdout.write('\x1B[?25h');
  }
}

/**
 * 进度条
 */
export class ProgressBar {
  private total: number;
  private current: number = 0;
  private barLength: number = 40;
  private message: string;

  constructor(total: number, message: string = '进度') {
    this.total = total;
    this.message = message;
  }

  update(current: number, message?: string): void {
    this.current = current;
    if (message) {
      this.message = message;
    }
    this.render();
  }

  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  private render(): void {
    const percentage = Math.min(100, Math.floor((this.current / this.total) * 100));
    const filledLength = Math.floor((this.barLength * this.current) / this.total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(this.barLength - filledLength);

    process.stdout.write(`\r${this.message}: [${bar}] ${percentage}% (${this.current}/${this.total})`);

    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  complete(message?: string): void {
    this.update(this.total, message);
  }
}

/**
 * 带超时的操作包装器
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = '操作超时'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

/**
 * 带进度显示的操作包装器
 */
export async function withSpinner<T>(
  promise: Promise<T>,
  message: string,
  successMessage?: string,
  errorMessage?: string
): Promise<T> {
  const spinner = new Spinner(message);
  spinner.start();

  try {
    const result = await promise;
    spinner.stop(successMessage || '✓ 完成');
    return result;
  } catch (error) {
    spinner.stop(errorMessage || '✗ 失败');
    throw error;
  }
}

/**
 * 带重试的操作包装器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const delay = options.delay || 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      if (options.onRetry) {
        options.onRetry(attempt, error);
      }

      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  throw new Error('不应该到达这里');
}
