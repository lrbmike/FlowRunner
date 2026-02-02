/**
 * FlowRunner - Chrome Recorder JSON 解析器
 * 解析 Chrome DevTools Recorder 导出的 JSON 文件
 */

export class RecorderParser {
  /**
   * 支持的步骤类型
   */
  static SUPPORTED_TYPES = [
    'navigate',
    'click',
    'doubleClick',
    'change',
    'keyDown',
    'keyUp',
    'scroll',
    'hover',
    'waitForElement',
    'waitForExpression',
    'setViewport'
  ];

  /**
   * 解析 JSON 字符串
   * @param {string} jsonString
   * @returns {{ success: boolean, data?: Object, error?: string }}
   */
  parse(jsonString) {
    try {
      // 解析 JSON
      const json = JSON.parse(jsonString);
      
      // 验证基本结构
      const validation = this.validate(json);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      
      // 提取并转换数据
      const data = this.transform(json);
      
      return { success: true, data };
      
    } catch (error) {
      console.error('[Parser] Parse error:', error);
      return { 
        success: false, 
        error: `JSON 解析失败: ${error.message}` 
      };
    }
  }

  /**
   * 验证 JSON 结构
   * @param {Object} json
   * @returns {{ valid: boolean, error?: string }}
   */
  validate(json) {
    // 检查是否为对象
    if (!json || typeof json !== 'object') {
      return { valid: false, error: '无效的 JSON 格式' };
    }
    
    // 检查 steps 数组
    if (!Array.isArray(json.steps)) {
      return { valid: false, error: '缺少 steps 数组' };
    }
    
    if (json.steps.length === 0) {
      return { valid: false, error: 'steps 数组为空' };
    }
    
    // 检查每个 step 的基本结构
    for (let i = 0; i < json.steps.length; i++) {
      const step = json.steps[i];
      
      if (!step.type) {
        return { valid: false, error: `步骤 ${i + 1} 缺少 type 属性` };
      }
      
      // 警告不支持的类型（但不阻止导入）
      if (!RecorderParser.SUPPORTED_TYPES.includes(step.type)) {
        console.warn(`[Parser] 步骤 ${i + 1} 使用了不支持的类型: ${step.type}`);
      }
    }
    
    return { valid: true };
  }

  /**
   * 转换数据格式
   * @param {Object} json
   * @returns {Object}
   */
  transform(json) {
    // 提取标题
    const title = json.title || '';
    
    // 处理步骤
    const steps = json.steps.map((step, index) => this.transformStep(step, index));
    
    // 提取起始 URL
    const startUrl = this.extractStartUrl(steps);
    
    return {
      title,
      startUrl,
      steps,
      originalJson: json
    };
  }

  /**
   * 转换单个步骤
   * @param {Object} step
   * @param {number} index
   * @returns {Object}
   */
  transformStep(step, index) {
    const transformed = {
      type: step.type,
      index
    };
    
    // 根据类型复制相关属性
    switch (step.type) {
      case 'navigate':
        transformed.url = step.url;
        break;
        
      case 'click':
      case 'doubleClick':
      case 'hover':
        transformed.selectors = this.normalizeSelectors(step.selectors);
        transformed.offsetX = step.offsetX;
        transformed.offsetY = step.offsetY;
        transformed.button = step.button;
        break;
        
      case 'change':
        transformed.selectors = this.normalizeSelectors(step.selectors);
        transformed.value = step.value;
        break;
        
      case 'keyDown':
      case 'keyUp':
        transformed.key = step.key;
        break;
        
      case 'scroll':
        transformed.x = step.x;
        transformed.y = step.y;
        transformed.selectors = step.selectors ? this.normalizeSelectors(step.selectors) : null;
        break;
        
      case 'waitForElement':
        transformed.selectors = this.normalizeSelectors(step.selectors);
        transformed.timeout = step.timeout;
        transformed.visible = step.visible;
        break;
        
      case 'waitForExpression':
        transformed.expression = step.expression;
        transformed.timeout = step.timeout;
        break;
        
      case 'setViewport':
        transformed.width = step.width;
        transformed.height = step.height;
        transformed.deviceScaleFactor = step.deviceScaleFactor;
        transformed.isMobile = step.isMobile;
        break;
        
      default:
        // 保留所有原始属性
        Object.assign(transformed, step);
    }
    
    // 复制可选的通用属性
    if (step.timeout !== undefined) {
      transformed.timeout = step.timeout;
    }
    if (step.assertedEvents) {
      transformed.assertedEvents = step.assertedEvents;
    }
    
    return transformed;
  }

  /**
   * 规范化选择器格式
   * @param {Array} selectors
   * @returns {Array}
   */
  normalizeSelectors(selectors) {
    if (!selectors || !Array.isArray(selectors)) {
      return [];
    }
    
    // Chrome Recorder 导出的选择器格式为 [[selector1], [selector2], ...]
    // 我们保持这个格式，方便后续执行时按优先级尝试
    return selectors.map(selectorGroup => {
      if (Array.isArray(selectorGroup)) {
        return selectorGroup;
      }
      return [selectorGroup];
    });
  }

  /**
   * 从步骤中提取起始 URL
   * @param {Array} steps
   * @returns {string|null}
   */
  extractStartUrl(steps) {
    const navigateStep = steps.find(s => s.type === 'navigate');
    return navigateStep?.url || null;
  }

  /**
   * 获取步骤的人类可读描述
   * @param {Object} step
   * @returns {string}
   */
  getStepDescription(step) {
    switch (step.type) {
      case 'navigate':
        return `导航到 ${step.url}`;
      case 'click':
        return `点击 ${this.getSelectorPreview(step.selectors)}`;
      case 'doubleClick':
        return `双击 ${this.getSelectorPreview(step.selectors)}`;
      case 'change':
        return `输入 "${step.value?.substring(0, 20) || ''}"`;
      case 'keyDown':
        return `按下 ${step.key}`;
      case 'keyUp':
        return `释放 ${step.key}`;
      case 'scroll':
        return `滚动到 (${step.x}, ${step.y})`;
      case 'hover':
        return `悬停 ${this.getSelectorPreview(step.selectors)}`;
      case 'waitForElement':
        return `等待 ${this.getSelectorPreview(step.selectors)}`;
      case 'waitForExpression':
        return `等待表达式`;
      case 'setViewport':
        return `设置视口 ${step.width}x${step.height}`;
      default:
        return step.type;
    }
  }

  /**
   * 获取选择器预览
   * @param {Array} selectors
   * @returns {string}
   */
  getSelectorPreview(selectors) {
    if (!selectors || selectors.length === 0) return '(无选择器)';
    
    const firstSelector = Array.isArray(selectors[0]) ? selectors[0][0] : selectors[0];
    if (!firstSelector) return '(无选择器)';
    
    // 截断过长的选择器
    if (firstSelector.length > 30) {
      return firstSelector.substring(0, 30) + '...';
    }
    return firstSelector;
  }
}
