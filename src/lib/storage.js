/**
 * FlowRunner - 存储管理模块
 * 封装 chrome.storage.local API，提供任务和日志的 CRUD 操作
 */

import { StorageKeys, DefaultSettings } from './types.js';

export class StorageManager {
  constructor() {
    this.cache = {
      tasks: null,
      logs: null,
      settings: null
    };
  }

  /**
   * 初始化存储
   */
  async initialize() {
    const data = await chrome.storage.local.get([
      StorageKeys.TASKS,
      StorageKeys.LOGS,
      StorageKeys.SETTINGS
    ]);

    // 如果没有数据，初始化为空数组/默认值
    if (!data[StorageKeys.TASKS]) {
      await chrome.storage.local.set({ [StorageKeys.TASKS]: [] });
    }
    if (!data[StorageKeys.LOGS]) {
      await chrome.storage.local.set({ [StorageKeys.LOGS]: [] });
    }
    if (!data[StorageKeys.SETTINGS]) {
      await chrome.storage.local.set({ [StorageKeys.SETTINGS]: DefaultSettings });
    }

    console.log('[Storage] Initialized');
  }

  // ==================== 任务管理 ====================

  /**
   * 获取所有任务
   * @returns {Promise<Array>}
   */
  async getAllTasks() {
    const data = await chrome.storage.local.get(StorageKeys.TASKS);
    return data[StorageKeys.TASKS] || [];
  }

  /**
   * 获取单个任务
   * @param {string} taskId
   * @returns {Promise<Object|null>}
   */
  async getTask(taskId) {
    const tasks = await this.getAllTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  /**
   * 保存新任务
   * @param {Object} task
   * @returns {Promise<Object>}
   */
  async saveTask(task) {
    const tasks = await this.getAllTasks();
    tasks.push(task);
    await chrome.storage.local.set({ [StorageKeys.TASKS]: tasks });
    console.log('[Storage] Task saved:', task.id);
    return { success: true, task };
  }

  /**
   * 更新任务
   * @param {string} taskId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateTask(taskId, updates) {
    const tasks = await this.getAllTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    
    if (index === -1) {
      return { success: false, error: '任务不存在' };
    }

    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ [StorageKeys.TASKS]: tasks });
    console.log('[Storage] Task updated:', taskId);
    return { success: true, task: tasks[index] };
  }

  /**
   * 删除任务
   * @param {string} taskId
   * @returns {Promise<Object>}
   */
  async deleteTask(taskId) {
    const tasks = await this.getAllTasks();
    const filteredTasks = tasks.filter(t => t.id !== taskId);
    
    if (filteredTasks.length === tasks.length) {
      return { success: false, error: '任务不存在' };
    }

    await chrome.storage.local.set({ [StorageKeys.TASKS]: filteredTasks });
    
    // 同时清除相关的定时器
    await chrome.alarms.clear(`task_${taskId}`);
    
    console.log('[Storage] Task deleted:', taskId);
    return { success: true };
  }

  // ==================== 日志管理 ====================

  /**
   * 获取日志
   * @param {string} taskId - 可选，按任务筛选
   * @param {number} limit - 可选，限制条数
   * @returns {Promise<Array>}
   */
  async getLogs(taskId = null, limit = 50) {
    const data = await chrome.storage.local.get(StorageKeys.LOGS);
    let logs = data[StorageKeys.LOGS] || [];

    if (taskId) {
      logs = logs.filter(l => l.taskId === taskId);
    }

    // 按时间倒序排列
    logs.sort((a, b) => b.executedAt - a.executedAt);

    return logs.slice(0, limit);
  }

  /**
   * 添加日志
   * @param {Object} log
   * @returns {Promise<Object>}
   */
  async addLog(log) {
    const data = await chrome.storage.local.get([StorageKeys.LOGS, StorageKeys.SETTINGS]);
    const logs = data[StorageKeys.LOGS] || [];
    const settings = data[StorageKeys.SETTINGS] || DefaultSettings;

    logs.unshift(log);

    // 限制日志数量
    const trimmedLogs = logs.slice(0, settings.maxLogs);

    await chrome.storage.local.set({ [StorageKeys.LOGS]: trimmedLogs });
    console.log('[Storage] Log added:', log.id);
    return { success: true };
  }

  /**
   * 清除任务相关日志
   * @param {string} taskId
   * @returns {Promise<Object>}
   */
  async clearTaskLogs(taskId) {
    const data = await chrome.storage.local.get(StorageKeys.LOGS);
    const logs = data[StorageKeys.LOGS] || [];
    const filteredLogs = logs.filter(l => l.taskId !== taskId);
    
    await chrome.storage.local.set({ [StorageKeys.LOGS]: filteredLogs });
    console.log('[Storage] Logs cleared for task:', taskId);
    return { success: true };
  }

  // ==================== 设置管理 ====================

  /**
   * 获取设置
   * @returns {Promise<Object>}
   */
  async getSettings() {
    const data = await chrome.storage.local.get(StorageKeys.SETTINGS);
    return { ...DefaultSettings, ...data[StorageKeys.SETTINGS] };
  }

  /**
   * 更新设置
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateSettings(updates) {
    const settings = await this.getSettings();
    const newSettings = { ...settings, ...updates };
    await chrome.storage.local.set({ [StorageKeys.SETTINGS]: newSettings });
    console.log('[Storage] Settings updated');
    return { success: true, settings: newSettings };
  }

  // ==================== 定时任务管理 ====================

  /**
   * 设置任务定时
   * @param {string} taskId
   * @param {Object} schedule
   * @returns {Promise<Object>}
   */
  async setTaskSchedule(taskId, schedule) {
    const alarmName = `task_${taskId}`;

    if (!schedule.enabled) {
      await chrome.alarms.clear(alarmName);
      console.log('[Storage] Alarm cleared for task:', taskId);
      return { success: true };
    }

    // 解析时间
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    // 计算下次执行时间
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    
    // 如果今天的时间已过，设置为明天
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    // 创建定时器（每天重复）
    await chrome.alarms.create(alarmName, {
      when: next.getTime(),
      periodInMinutes: 24 * 60 // 每24小时
    });

    console.log('[Storage] Alarm set for task:', taskId, 'next run:', next);
    return { success: true, nextRun: next.getTime() };
  }
}
