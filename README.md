# FlowRunner - 浏览器自动化任务管理器

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)

FlowRunner 是一个 Chrome 浏览器插件，通过导入 Chrome DevTools Recorder
录制的操作流程，实现网页自动化任务执行。

## ✨ 功能特性

- 📥 **导入录制** - 支持导入 Chrome Recorder 导出的 JSON 文件
- 📋 **任务管理** - 增删改查已导入的自动化任务
- ▶️ **一键执行** - 手动触发任务执行
- ⏰ **定时任务** - 支持设置每日定时自动执行（可选）
- 📊 **执行日志** - 查看任务执行历史和状态

## 🎯 应用场景

| 场景           | 说明                         |
| -------------- | ---------------------------- |
| **自动签到**   | 论坛、社区、网站每日签到打卡 |
| **自动填表**   | 重复表单自动填写             |
| **定时刷新**   | 定时打开并刷新特定页面       |
| **批量操作**   | 批量点赞、收藏、关注等       |
| **数据监控**   | 定期检查页面内容变化         |
| **自动化测试** | 网站功能回归测试             |

## 🚀 快速开始

### 1. 安装插件

1. 下载或克隆本项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本项目的根目录

### 2. 录制操作流程

1. 打开目标网站
2. 按 `F12` 打开开发者工具
3. 点击「更多选项」(⋮) → 「更多工具」→「Recorder」
4. 点击「创建新录制」，开始录制
5. 执行你想要自动化的操作（点击、输入、滚动等）
6. 点击「结束录制」
7. 点击「导出」→ 选择「JSON」格式并保存

### 3. 导入任务

1. 点击浏览器工具栏的 FlowRunner 图标
2. 点击「导入录制」按钮
3. 选择导出的 JSON 文件
4. 确认任务信息后导入

### 4. 执行任务

- **手动执行**：点击任务卡片的「执行」按钮
- **定时执行**：在任务详情中开启定时开关，设置执行时间

## 📁 项目结构

```
FlowRunner/
├── manifest.json              # 插件配置文件 (Manifest V3)
├── src/
│   ├── popup/                 # 弹出窗口 UI
│   │   ├── index.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── background/            # 后台 Service Worker
│   │   └── service-worker.js
│   ├── content/               # 内容脚本
│   │   └── executor.js
│   └── lib/                   # 共享库
│       ├── parser.js          # Recorder JSON 解析器
│       ├── storage.js         # 存储管理
│       └── types.js           # 类型定义
├── assets/                    # 静态资源
│   └── icons/
├── examples/                  # 示例文件
│   └── sample-recording.json
└── docs/                      # 文档
```

## 🔧 支持的操作类型

| 操作类型            | 说明           |
| ------------------- | -------------- |
| `navigate`          | 页面跳转       |
| `click`             | 点击元素       |
| `doubleClick`       | 双击元素       |
| `change`            | 输入值         |
| `keyDown` / `keyUp` | 按键操作       |
| `scroll`            | 页面滚动       |
| `hover`             | 鼠标悬停       |
| `waitForElement`    | 等待元素出现   |
| `waitForExpression` | 等待表达式为真 |

## ⚠️ 注意事项

1. **密码安全**：如果录制过程中输入了密码，JSON
   文件中会包含明文密码。请妥善保管录制文件。
2. **验证码**：对于需要输入动态验证码的网站，自动化可能无法完成。
3. **网站变更**：如果目标网站的页面结构发生变化，可能需要重新录制。
4. **权限说明**：插件需要 `<all_urls>` 权限以支持任意网站的自动化操作。

## 📝 开发说明

本插件使用 Manifest V3 开发，主要技术：

- **Service Worker** - 后台任务调度
- **Content Script** - 页面内操作执行
- **Chrome Storage API** - 任务数据存储
- **Chrome Alarms API** - 定时任务调度

## 🔮 未来规划

- [ ] 变量支持（动态日期、随机数等）
- [ ] 条件分支（根据页面状态选择执行路径）
- [ ] 循环执行（对列表项重复操作）
- [ ] 数据提取（执行过程中抓取页面数据）
- [ ] 任务分组管理
- [ ] 导出/备份任务配置

## 📄 许可证

MIT License
