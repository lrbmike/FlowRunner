/**
 * FlowRunner Popup 主脚本
 * 处理 UI 交互和与 Service Worker 的通信
 */

import { MessageType, createTask } from '../lib/types.js';
import { RecorderParser } from '../lib/parser.js';

// ==================== DOM 元素 ====================
const elements = {
  btnImport: document.getElementById('btn-import'),
  btnRefresh: document.getElementById('btn-refresh'),
  fileInput: document.getElementById('file-input'),
  taskList: document.getElementById('task-list'),
  emptyState: document.getElementById('empty-state'),
  statusText: document.getElementById('status-text'),
  
  // 模态框
  modalOverlay: document.getElementById('modal-overlay'),
  modalTitle: document.getElementById('modal-title'),
  modalContent: document.getElementById('modal-content'),
  modalClose: document.getElementById('modal-close'),
  modalCancel: document.getElementById('modal-cancel'),
  modalConfirm: document.getElementById('modal-confirm')
};

// 解析器实例
const parser = new RecorderParser();

// 当前任务列表
let tasks = [];

// 模态框状态
let modalState = {
  type: null,
  data: null,
  onConfirm: null
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  
  // 绑定事件
  bindEvents();
  
  // 加载任务列表
  await loadTasks();
  
  updateStatus('就绪');
});

// ==================== 事件绑定 ====================
function bindEvents() {
  // 导入按钮
  elements.btnImport.addEventListener('click', () => {
    elements.fileInput.click();
  });
  
  // 文件选择
  elements.fileInput.addEventListener('change', handleFileSelect);
  
  // 刷新按钮
  elements.btnRefresh.addEventListener('click', loadTasks);
  
  // 模态框事件
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalCancel.addEventListener('click', closeModal);
  elements.modalConfirm.addEventListener('click', handleModalConfirm);
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) {
      closeModal();
    }
  });
}

// ==================== 任务加载 ====================
async function loadTasks() {
  try {
    updateStatus('加载中...');
    
    const response = await sendMessage({ type: MessageType.GET_TASKS });
    tasks = response || [];
    
    renderTaskList();
    updateStatus(`已加载 ${tasks.length} 个任务`);
    
  } catch (error) {
    console.error('[Popup] Failed to load tasks:', error);
    updateStatus('加载失败');
  }
}

// ==================== 任务渲染 ====================
function renderTaskList() {
  if (tasks.length === 0) {
    elements.taskList.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    return;
  }
  
  elements.emptyState.classList.add('hidden');
  
  elements.taskList.innerHTML = tasks.map(task => `
    <div class="task-card" data-task-id="${task.id}">
      <div class="task-header">
        <div class="task-info">
          <div class="task-name">${escapeHtml(task.name)}</div>
          <div class="task-url">${escapeHtml(task.url || '未知 URL')}</div>
        </div>
        <div class="task-status">
          ${renderStatusBadge(task.lastStatus)}
        </div>
      </div>
      <div class="task-meta">
        <span>📋 ${task.steps?.length || 0} 步骤</span>
        ${task.lastExecutedAt ? `<span>⏱️ ${formatTime(task.lastExecutedAt)}</span>` : ''}
        ${task.schedule?.enabled ? '<span>⏰ 已设定时</span>' : ''}
      </div>
      <div class="task-actions">
        <button class="btn btn-success btn-sm btn-action-execute" data-id="${task.id}">
          ▶️ 执行
        </button>
        <button class="btn btn-secondary btn-sm btn-action-detail" data-id="${task.id}">
          📝 详情
        </button>
        <button class="btn btn-secondary btn-sm btn-action-delete" data-id="${task.id}">
          🗑️
        </button>
      </div>
    </div>
  `).join('');

  // 重新绑定事件
  document.querySelectorAll('.btn-action-execute').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      executeTask(btn.dataset.id);
    });
  });

  document.querySelectorAll('.btn-action-detail').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showTaskDetail(btn.dataset.id);
    });
  });

  document.querySelectorAll('.btn-action-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteTask(btn.dataset.id);
    });
  });
}

function renderStatusBadge(status) {
  if (!status) {
    return '<span class="status-badge pending">待执行</span>';
  }
  
  switch (status) {
    case 'success':
      return '<span class="status-badge success">✓ 成功</span>';
    case 'failed':
      return '<span class="status-badge failed">✗ 失败</span>';
    case 'partial':
      return '<span class="status-badge failed">⚠ 部分完成</span>';
    default:
      return '<span class="status-badge pending">待执行</span>';
  }
}

// ==================== 文件导入 ====================
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  updateStatus('正在解析...');
  
  try {
    const jsonText = await readFileAsText(file);
    const result = parser.parse(jsonText);
    
    if (!result.success) {
      showError('解析失败', result.error);
      return;
    }
    
    // 创建任务对象
    const task = createTask({
      name: result.data.title || file.name.replace('.json', ''),
      url: result.data.startUrl,
      steps: result.data.steps,
      originalJson: result.data.originalJson
    });
    
    // 显示确认对话框
    showImportConfirm(task);
    
  } catch (error) {
    console.error('[Popup] Parse error:', error);
    showError('导入失败', error.message);
  } finally {
    // 重置文件输入
    event.target.value = '';
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

function showImportConfirm(task) {
  modalState = {
    type: 'import',
    data: task,
    onConfirm: async () => {
      await saveTask(task);
    }
  };
  
  elements.modalTitle.textContent = '导入确认';
  elements.modalContent.innerHTML = `
    <div class="form-group">
      <label class="form-label">任务名称</label>
      <input type="text" class="form-input" id="import-name" value="${escapeHtml(task.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">起始 URL</label>
      <div style="color: var(--text-muted); font-size: 12px; word-break: break-all;">
        ${escapeHtml(task.url || '无')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">步骤数量</label>
      <div style="color: var(--text-secondary);">${task.steps.length} 个步骤</div>
    </div>
  `;
  
  elements.modalConfirm.textContent = '导入';
  openModal();
}

async function saveTask(task) {
  try {
    // 获取可能修改的名称
    const nameInput = document.getElementById('import-name');
    if (nameInput) {
      task.name = nameInput.value || task.name;
    }
    
    updateStatus('正在保存...');
    
    await sendMessage({
      type: MessageType.SAVE_TASK,
      task
    });
    
    updateStatus('导入成功');
    await loadTasks();
    
  } catch (error) {
    console.error('[Popup] Save error:', error);
    showError('保存失败', error.message);
  }
}

// ==================== 任务操作 ====================

// 执行任务
async function executeTask(taskId) {
  try {
    updateStatus('正在执行...');
    
    const response = await sendMessage({
      type: MessageType.EXECUTE_TASK,
      taskId
    });
    
    if (response.success) {
      updateStatus('执行完成');
    } else {
      updateStatus('执行失败: ' + (response.error || '未知错误'));
    }
    
    // 刷新列表以更新状态
    setTimeout(loadTasks, 1000);
    
  } catch (error) {
    console.error('[Popup] Execute error:', error);
    updateStatus('执行失败');
  }
};

// 显示任务详情
function showTaskDetail(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  modalState = {
    type: 'detail',
    data: task,
    onConfirm: async () => {
      await updateTaskFromDetail(taskId);
    }
  };
  
  elements.modalTitle.textContent = '任务详情';
  elements.modalContent.innerHTML = `
    <div class="form-group">
      <label class="form-label">任务名称</label>
      <input type="text" class="form-input" id="detail-name" value="${escapeHtml(task.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">起始 URL</label>
      <div style="color: var(--text-muted); font-size: 12px; word-break: break-all;">
        ${escapeHtml(task.url || '无')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">步骤列表</label>
      <div style="max-height: 120px; overflow-y: auto; font-size: 12px; color: var(--text-secondary);">
        ${task.steps.map((step, i) => `
          <div style="padding: 4px 0; border-bottom: 1px solid var(--border-color);">
            ${i + 1}. <strong>${step.type}</strong>
            ${step.url ? ` - ${step.url.substring(0, 30)}...` : ''}
            ${step.selectors ? ` - ${step.selectors[0]?.[0]?.substring(0, 20) || ''}...` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">错误处理</label>
      <select class="form-input" id="detail-error-policy">
        <option value="stop" ${task.errorPolicy === 'stop' ? 'selected' : ''}>遇到错误停止 (默认)</option>
        <option value="continue" ${task.errorPolicy === 'continue' ? 'selected' : ''}>忽略错误继续执行</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" style="display: flex; align-items: center; justify-content: space-between;">
        <span>定时执行</span>
        <label class="switch">
          <input type="checkbox" id="detail-schedule" ${task.schedule?.enabled ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </label>
    </div>
    <div class="form-group" id="schedule-time-group" style="${task.schedule?.enabled ? '' : 'display: none;'}">
      <label class="form-label">执行时间</label>
      <input type="time" class="form-input" id="detail-time" value="${task.schedule?.time || '09:00'}">
    </div>
  `;
  
  // 绑定定时开关事件
  setTimeout(() => {
    const scheduleCheckbox = document.getElementById('detail-schedule');
    const timeGroup = document.getElementById('schedule-time-group');
    if (scheduleCheckbox && timeGroup) {
      scheduleCheckbox.addEventListener('change', (e) => {
        timeGroup.style.display = e.target.checked ? '' : 'none';
      });
    }
  }, 0);
  
  elements.modalConfirm.textContent = '保存';
  openModal();
};

async function updateTaskFromDetail(taskId) {
  try {
    const name = document.getElementById('detail-name')?.value;
    const errorPolicy = document.getElementById('detail-error-policy')?.value;
    const scheduleEnabled = document.getElementById('detail-schedule')?.checked;
    const scheduleTime = document.getElementById('detail-time')?.value;
    
    await sendMessage({
      type: MessageType.UPDATE_TASK,
      taskId,
      updates: {
        name,
        errorPolicy,
        schedule: {
          enabled: scheduleEnabled,
          time: scheduleTime,
          days: [0, 1, 2, 3, 4, 5, 6]
        }
      }
    });
    
    updateStatus('已保存');
    await loadTasks();
    
  } catch (error) {
    console.error('[Popup] Update error:', error);
    showError('保存失败', error.message);
  }
}

// 删除确认
function confirmDeleteTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  modalState = {
    type: 'delete',
    data: task,
    onConfirm: async () => {
      await deleteTask(taskId);
    }
  };
  
  elements.modalTitle.textContent = '删除确认';
  elements.modalContent.innerHTML = `
    <p style="text-align: center; color: var(--text-secondary);">
      确定要删除任务 "<strong>${escapeHtml(task.name)}</strong>" 吗？
    </p>
    <p style="text-align: center; color: var(--error-color); font-size: 12px; margin-top: 8px;">
      此操作不可撤销
    </p>
  `;
  
  elements.modalConfirm.textContent = '删除';
  elements.modalConfirm.classList.add('btn-danger');
  elements.modalConfirm.classList.remove('btn-primary');
  openModal();
};

async function deleteTask(taskId) {
  try {
    await sendMessage({
      type: MessageType.DELETE_TASK,
      taskId
    });
    
    updateStatus('已删除');
    await loadTasks();
    
  } catch (error) {
    console.error('[Popup] Delete error:', error);
    showError('删除失败', error.message);
  }
}

// ==================== 模态框 ====================
function openModal() {
  elements.modalOverlay.classList.remove('hidden');
}

function closeModal() {
  elements.modalOverlay.classList.add('hidden');
  
  // 重置确认按钮样式
  elements.modalConfirm.classList.remove('btn-danger');
  elements.modalConfirm.classList.add('btn-primary');
  
  modalState = { type: null, data: null, onConfirm: null };
}

function handleModalConfirm() {
  if (modalState.onConfirm) {
    modalState.onConfirm();
  }
  closeModal();
}

function showError(title, message) {
  elements.modalTitle.textContent = title;
  elements.modalContent.innerHTML = `
    <div style="text-align: center; color: var(--error-color);">
      <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  elements.modalConfirm.style.display = 'none';
  elements.modalCancel.textContent = '关闭';
  openModal();
  
  // 重置
  setTimeout(() => {
    elements.modalConfirm.style.display = '';
    elements.modalCancel.textContent = '取消';
  }, 100);
}

// ==================== 工具函数 ====================
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function updateStatus(text) {
  elements.statusText.textContent = text;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  
  // 今天
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  
  // 其他
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

console.log('[Popup] Script loaded');
