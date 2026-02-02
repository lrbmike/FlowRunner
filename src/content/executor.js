/**
 * FlowRunner - Content Script 执行器
 * 在目标网页中执行录制的操作步骤
 */

// 注意：Content Script 不能使用 ES modules，所以这里使用 IIFE
(function() {
  'use strict';

  // 消息类型常量（与 types.js 保持一致）
  const MessageType = {
    EXECUTE_STEPS: 'EXECUTE_STEPS',
    STEP_COMPLETED: 'STEP_COMPLETED',
    EXECUTION_RESULT: 'EXECUTION_RESULT'
  };

  const ExecutionStatus = {
    SUCCESS: 'success',
    FAILED: 'failed',
    PARTIAL: 'partial'
  };

  // 默认配置
  const Config = {
    stepDelay: 500,        // 步骤间延迟
    elementTimeout: 10000, // 元素等待超时
    retryCount: 3          // 重试次数
  };

  /**
   * 监听来自 Service Worker 的消息
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MessageType.EXECUTE_STEPS) {
      console.log('[Executor] Received execute command');
      executeSteps(message.steps, message.taskId, message.taskName, message.errorPolicy)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message 
        }));
      return true; // 异步响应
    }
  });

  /**
   * 执行步骤序列
   */
  async function executeSteps(steps, taskId, taskName, errorPolicy = 'stop') {
    const startTime = Date.now();
    let completedSteps = 0;
    let lastError = null;
    let hasFailedSteps = false;

    console.log(`[Executor] Starting execution of ${steps.length} steps. Policy: ${errorPolicy}`);

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`[Executor] Step ${i + 1}/${steps.length}:`, step.type);

        try {
          await executeStep(step);
          completedSteps++;
          
          // 步骤间延迟
          if (i < steps.length - 1) {
            await delay(Config.stepDelay);
          }
        } catch (error) {
          if (errorPolicy === 'continue') {
             console.warn(`[Executor] Step ${i + 1} failed (Ignored):`, error.message);
             // console.warn('[Executor] Ignoring error based on policy, continuing...'); // 合并为一条日志更清爽
             hasFailedSteps = true;
             lastError = error; // 仍然记录最后一个错误用于最终状态判断
             continue; // 继续执行下一步
          } else {
             console.error(`[Executor] Step ${i + 1} failed:`, error);
             lastError = error;
             break; // 停止执行
          }
        }
      }

      const duration = Date.now() - startTime;
      
      // 确定最终状态
      let status = ExecutionStatus.SUCCESS;
      if (lastError && errorPolicy === 'stop') {
        status = ExecutionStatus.FAILED;
      } else if (hasFailedSteps) {
        status = ExecutionStatus.PARTIAL; // 标记为部分成功
      } else if (completedSteps < steps.length) {
        status = ExecutionStatus.PARTIAL;
      }

      // 发送执行结果给 Service Worker
      const result = {
        success: status === ExecutionStatus.SUCCESS,
        status,
        completedSteps,
        totalSteps: steps.length,
        duration,
        message: lastError ? lastError.message : '执行完成'
      };

      // 通知 Service Worker 记录日志
      chrome.runtime.sendMessage({
        type: MessageType.EXECUTION_RESULT,
        taskId,
        taskName,
        status,
        message: result.message,
        duration
      });

      return result;

    } catch (error) {
      console.error('[Executor] Execution failed:', error);
      
      chrome.runtime.sendMessage({
        type: MessageType.EXECUTION_RESULT,
        taskId,
        taskName,
        status: ExecutionStatus.FAILED,
        message: error.message,
        duration: Date.now() - startTime
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 执行单个步骤
   */
  async function executeStep(step) {
    switch (step.type) {
      case 'navigate':
        return await handleNavigate(step);
      case 'click':
        return await handleClick(step);
      case 'doubleClick':
        return await handleDoubleClick(step);
      case 'change':
        return await handleChange(step);
      case 'keyDown':
        return await handleKeyDown(step);
      case 'keyUp':
        return await handleKeyUp(step);
      case 'scroll':
        return await handleScroll(step);
      case 'hover':
        return await handleHover(step);
      case 'waitForElement':
        return await handleWaitForElement(step);
      case 'waitForExpression':
        return await handleWaitForExpression(step);
      case 'setViewport':
        // Content Script 无法改变视口，跳过
        console.log('[Executor] Skipping setViewport step');
        return;
      default:
        console.warn('[Executor] Unknown step type:', step.type);
    }
  }

  // ==================== 步骤处理函数 ====================

  async function handleNavigate(step) {
    // 在 Content Script 中，导航由 Service Worker 处理
    // 这里只是记录日志
    console.log('[Executor] Navigate step (handled by service worker):', step.url);
  }

  async function handleClick(step) {
    const element = await findElement(step.selectors);
    if (!element) {
      throw new Error('找不到点击目标元素');
    }
    
    // 滚动到元素可见
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(200);
    
    // 模拟点击
    element.click();
    console.log('[Executor] Clicked element');
  }

  async function handleDoubleClick(step) {
    const element = await findElement(step.selectors);
    if (!element) {
      throw new Error('找不到双击目标元素');
    }
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(200);
    
    const event = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(event);
    console.log('[Executor] Double-clicked element');
  }

  async function handleChange(step) {
    const element = await findElement(step.selectors);
    if (!element) {
      throw new Error('找不到输入目标元素');
    }
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(200);
    
    // 聚焦元素
    element.focus();
    
    // 清空并输入新值
    element.value = '';
    element.value = step.value;
    
    // 触发 input 和 change 事件
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log('[Executor] Changed input value');
  }

  async function handleKeyDown(step) {
    const event = new KeyboardEvent('keydown', {
      key: step.key,
      bubbles: true
    });
    document.activeElement.dispatchEvent(event);
    console.log('[Executor] KeyDown:', step.key);
  }

  async function handleKeyUp(step) {
    const event = new KeyboardEvent('keyup', {
      key: step.key,
      bubbles: true
    });
    document.activeElement.dispatchEvent(event);
    console.log('[Executor] KeyUp:', step.key);
  }

  async function handleScroll(step) {
    if (step.selectors) {
      const element = await findElement(step.selectors);
      if (element) {
        element.scrollTo(step.x || 0, step.y || 0);
      }
    } else {
      window.scrollTo(step.x || 0, step.y || 0);
    }
    console.log('[Executor] Scrolled to:', step.x, step.y);
  }

  async function handleHover(step) {
    const element = await findElement(step.selectors);
    if (!element) {
      throw new Error('找不到悬停目标元素');
    }
    
    const event = new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(event);
    console.log('[Executor] Hovered element');
  }

  async function handleWaitForElement(step) {
    await findElement(step.selectors, Config.elementTimeout);
    console.log('[Executor] Element found');
  }

  async function handleWaitForExpression(step) {
    const timeout = step.timeout || Config.elementTimeout;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // 使用 Function 构造器执行表达式
        const result = new Function(`return ${step.expression}`)();
        if (result) {
          console.log('[Executor] Expression evaluated to true');
          return;
        }
      } catch (e) {
        // 表达式执行失败，继续等待
      }
      await delay(100);
    }
    
    throw new Error('等待表达式超时');
  }

  // ==================== 工具函数 ====================

  /**
   * 查找元素（支持多种选择器）
   */
  async function findElement(selectors, timeout = Config.elementTimeout) {
    if (!selectors || selectors.length === 0) {
      return null;
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      for (const selectorGroup of selectors) {
        const selector = Array.isArray(selectorGroup) ? selectorGroup[0] : selectorGroup;
        
        try {
          let element = null;
          
          if (selector.startsWith('xpath/')) {
            // XPath 选择器
            const xpath = selector.replace('xpath/', '');
            const result = document.evaluate(
              xpath, 
              document, 
              null, 
              XPathResult.FIRST_ORDERED_NODE_TYPE, 
              null
            );
            element = result.singleNodeValue;
          } else if (selector.startsWith('aria/')) {
            // ARIA 选择器
            const ariaLabel = selector.replace('aria/', '');
            element = document.querySelector(`[aria-label="${ariaLabel}"]`) ||
                      document.querySelector(`[aria-labelledby="${ariaLabel}"]`);
          } else if (selector.startsWith('pierce/')) {
            // Pierce 选择器（穿透 Shadow DOM）
            const pierceSelector = selector.replace('pierce/', '');
            element = document.querySelector(pierceSelector);
          } else {
            // CSS 选择器
            element = document.querySelector(selector);
          }
          
          if (element) {
            return element;
          }
        } catch (e) {
          console.warn('[Executor] Selector failed:', selector, e);
        }
      }
      
      await delay(100);
    }

    return null;
  }

  /**
   * 延迟函数
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  console.log('[Executor] FlowRunner Content Script loaded');
})();
