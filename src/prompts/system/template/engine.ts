/**
 * 🔄 95% 复用自原系统
 * 来源: 提示词/系统提示词/模板引擎/模板引擎.ts
 * 
 * 核心作用：解析模板中的 {{placeholder}} 并替换为实际内容
 * 
 * 主要改动：
 * - 移除日志输出（CLI 环境不需要）
 */

/**
 * 模板引擎类
 * 负责解析和替换模板中的占位符
 */
export class TemplateEngine {
  /**
   * 占位符正则表达式
   * 匹配 {{KEY}} 或 {{obj.nested.key}} 格式
   */
  private static readonly PLACEHOLDER_REGEX = /\{\{\s*([\w\.]+)\s*\}\}/g;

  /**
   * 解析模板，将占位符替换为实际值
   * 
   * @param template - 包含占位符的模板字符串
   * @param values - 占位符对应的值
   * @returns 解析后的字符串
   * 
   * @example
   * ```typescript
   * const template = "Hello {{user.name}}, you are {{age}} years old";
   * const values = { user: { name: "Alice" }, age: 25 };
   * const result = engine.resolve(template, values);
   * // 结果: "Hello Alice, you are 25 years old"
   * ```
   */
  resolve(template: string, values: Record<string, any>): string {
    return template.replace(TemplateEngine.PLACEHOLDER_REGEX, (match, key) => {
      const value = this.getNestedValue(values, key);
      
      if (value === undefined || value === null) {
        // 如果找不到值，保留原始占位符
        return match;
      }
      
      return String(value);
    });
  }

  /**
   * 提取模板中的所有占位符
   * 
   * @param template - 模板字符串
   * @returns 占位符数组
   * 
   * @example
   * ```typescript
   * const template = "{{name}} is {{age}} years old";
   * const placeholders = engine.extractPlaceholders(template);
   * // 结果: ["name", "age"]
   * ```
   */
  extractPlaceholders(template: string): string[] {
    const placeholders: string[] = [];
    const regex = new RegExp(TemplateEngine.PLACEHOLDER_REGEX);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(template)) !== null) {
      placeholders.push(match[1]);
    }

    return [...new Set(placeholders)]; // 去重
  }

  /**
   * 验证模板中的所有占位符是否都有对应的值
   * 
   * @param template - 模板字符串
   * @param values - 占位符值
   * @returns 验证结果，包含是否有效和缺失的占位符列表
   */
  validatePlaceholders(
    template: string,
    values: Record<string, any>
  ): { isValid: boolean; missing: string[] } {
    const placeholders = this.extractPlaceholders(template);
    const missing: string[] = [];

    for (const placeholder of placeholders) {
      const value = this.getNestedValue(values, placeholder);
      if (value === undefined || value === null) {
        missing.push(placeholder);
      }
    }

    return {
      isValid: missing.length === 0,
      missing,
    };
  }

  /**
   * 获取嵌套对象的值
   * 支持点记法（dot notation），如 "user.name" 或 "config.api.key"
   * 
   * @param obj - 对象
   * @param path - 属性路径
   * @returns 对应的值，找不到返回 undefined
   * 
   * @example
   * ```typescript
 * const obj = { user: { profile: { name: "Alice" } } };
   * const value = engine.getNestedValue(obj, "user.profile.name");
   * // 结果: "Alice"
   * ```
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }
}

/**
 * 单例模板引擎实例
 * 提供便捷的访问方式
 */
export const templateEngine = new TemplateEngine();
