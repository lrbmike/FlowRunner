/**
 * FlowRunner - 类型定义和常量
 */

/**
 * 步骤类型枚举
 */
export const StepType = {
  NAVIGATE: 'navigate',
  CLICK: 'click',
  DOUBLE_CLICK: 'doubleClick',
  CHANGE: 'change',
  KEY_DOWN: 'keyDown',
  KEY_UP: 'keyUp',
  SCROLL: 'scroll',
  WAIT_FOR_ELEMENT: 'waitForElement',
  WAIT_FOR_EXPRESSION: 'waitForExpression',
  SET_VIEWPORT: 'setViewport',
  HOVER: 'hover'
};

/**
 * 任务执行状态
 */
export const ExecutionStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PARTIAL: 'partial',
  RUNNING: 'running',
  PENDING: 'pending'
};

/**
 * 消息类型（用于组件间通信）
 */
export const MessageType = {
  // Popup -> Background
  EXECUTE_TASK: 'EXECUTE_TASK',
  GET_TASKS: 'GET_TASKS',
  SAVE_TASK: 'SAVE_TASK',
  DELETE_TASK: 'DELETE_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  GET_LOGS: 'GET_LOGS',
  
  // Background -> Content Script
  EXECUTE_STEPS: 'EXECUTE_STEPS',
  
  // Content Script -> Background
  STEP_COMPLETED: 'STEP_COMPLETED',
  EXECUTION_RESULT: 'EXECUTION_RESULT'
};

/**
 * 存储键名
 */
export const StorageKeys = {
  TASKS: 'flowrunner_tasks',
  LOGS: 'flowrunner_logs',
  SETTINGS: 'flowrunner_settings'
};

/**
 * 默认设置
 */
export const DefaultSettings = {
  maxLogs: 100,           // 最大日志条数
  stepDelay: 500,         // 步骤间延迟（毫秒）
  elementTimeout: 10000,  // 元素等待超时（毫秒）
  notifyOnComplete: true  // 执行完成后通知
};

/**
 * 生成唯一 ID
 * @returns {string}
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 错误处理策略
 */
export const ErrorPolicy = {
  STOP: 'stop',       // 遇到错误停止（默认）
  CONTINUE: 'continue' // 忽略错误继续
};

/**
 * 创建新任务对象
 * @param {Object} params
 * @returns {Object}
 */
export function createTask({ name, url, steps, originalJson }) {
  const now = Date.now();
  return {
    id: generateId(),
    name: name || '未命名任务',
    url: url || '',
    steps: steps || [],
    originalJson: originalJson || null,
    enabled: true,
    errorPolicy: ErrorPolicy.STOP, // 默认策略
    schedule: {
      enabled: false,
      time: '09:00',
      days: [1, 2, 3, 4, 5] // 默认工作日
    },
    createdAt: now,
    updatedAt: now,
    lastExecutedAt: null,
    lastStatus: null
  };
}

/**
 * 创建执行日志对象
 * @param {Object} params
 * @returns {Object}
 */
export function createLog({ taskId, taskName, status, message, duration }) {
  return {
    id: generateId(),
    taskId,
    taskName,
    status,
    message: message || '',
    duration: duration || 0,
    executedAt: Date.now()
  };
}
