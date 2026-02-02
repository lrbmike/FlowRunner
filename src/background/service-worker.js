/**
 * FlowRunner - Background Service Worker
 * 负责：定时任务调度、任务执行协调、消息中转
 */

import { MessageType, ExecutionStatus, createLog } from '../lib/types.js';
import { StorageManager } from '../lib/storage.js';

const storage = new StorageManager();

/**
 * 监听来自 Popup 和 Content Script 的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ServiceWorker] Received message:', message.type);
  
  // 使用 async/await 需要返回 true 表示异步响应
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('[ServiceWorker] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });
  
  return true; // 保持消息通道开放
});

/**
 * 处理消息
 */
async function handleMessage(message, sender) {
  switch (message.type) {
    case MessageType.GET_TASKS:
      return await storage.getAllTasks();
    
    case MessageType.SAVE_TASK:
      return await storage.saveTask(message.task);
    
    case MessageType.DELETE_TASK:
      return await storage.deleteTask(message.taskId);
    
    case MessageType.UPDATE_TASK:
      return await storage.updateTask(message.taskId, message.updates);
    
    case MessageType.GET_LOGS:
      return await storage.getLogs(message.taskId);
    
    case MessageType.EXECUTE_TASK:
      return await executeTask(message.taskId);
    
    case MessageType.EXECUTION_RESULT:
      return await handleExecutionResult(message);
    
    default:
      console.warn('[ServiceWorker] Unknown message type:', message.type);
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * 执行自动化任务
 */
async function executeTask(taskId) {
  try {
    const tasks = await storage.getAllTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error('任务不存在');
    }
    
    console.log('[ServiceWorker] Executing task:', task.name);
    
    // 获取起始 URL
    const startUrl = task.url || getStartUrl(task.steps);
    if (!startUrl) {
      throw new Error('无法确定起始 URL');
    }
    
    // 创建或激活标签页
    const tab = await chrome.tabs.create({ url: startUrl, active: true });
    
    // 等待页面加载完成
    await waitForTabLoad(tab.id);
    
    // 向 Content Script 发送执行指令
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: MessageType.EXECUTE_STEPS,
      steps: task.steps,
      taskId: task.id,
      taskName: task.name,
      errorPolicy: task.errorPolicy || 'stop',
      stepTimeout: task.timeout || 5000,
      randomDelay: task.randomDelay || false
    });
    
    return response;
    
  } catch (error) {
    console.error('[ServiceWorker] Task execution error:', error);
    
    // 记录失败日志
    await storage.addLog(createLog({
      taskId,
      taskName: '未知任务',
      status: ExecutionStatus.FAILED,
      message: error.message
    }));
    
    return { success: false, error: error.message };
  }
}

/**
 * 处理执行结果
 */
async function handleExecutionResult(message) {
  const { taskId, taskName, status, message: resultMessage, duration } = message;
  
  // 记录日志
  await storage.addLog(createLog({
    taskId,
    taskName,
    status,
    message: resultMessage,
    duration
  }));
  
  // 更新任务的最后执行状态
  await storage.updateTask(taskId, {
    lastExecutedAt: Date.now(),
    lastStatus: status
  });
  
  // 发送通知（如果启用）
  if (status === ExecutionStatus.SUCCESS) {
    await showNotification('执行成功', `${taskName} 任务已完成`);
  } else if (status === ExecutionStatus.FAILED) {
    await showNotification('执行失败', `${taskName} 执行失败: ${resultMessage}`);
  }
  
  return { success: true };
}

/**
 * 从步骤中提取起始 URL
 */
function getStartUrl(steps) {
  if (!steps || steps.length === 0) return null;
  
  const navigateStep = steps.find(s => s.type === 'navigate');
  return navigateStep?.url || null;
}

/**
 * 等待标签页加载完成
 */
function waitForTabLoad(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkTab = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (tab.status === 'complete') {
          resolve(tab);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('页面加载超时'));
        } else {
          setTimeout(checkTab, 100);
        }
      });
    };
    
    checkTab();
  });
}

/**
 * 显示浏览器通知
 */
async function showNotification(title, message) {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/assets/icons/icon128.png',
      title,
      message
    });
  } catch (error) {
    console.error('[ServiceWorker] Notification error:', error);
  }
}

/**
 * 监听定时器事件
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[ServiceWorker] Alarm triggered:', alarm.name);
  
  if (alarm.name.startsWith('task_')) {
    const taskId = alarm.name.replace('task_', '');
    await executeTask(taskId);
  }
});

/**
 * 插件安装/更新时初始化
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ServiceWorker] Extension installed/updated:', details.reason);
  
  // 初始化存储
  storage.initialize();

  // 配置点击图标打开侧边栏
  // 注意：需要 Chrome 114+
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
});

console.log('[ServiceWorker] FlowRunner Service Worker loaded');
