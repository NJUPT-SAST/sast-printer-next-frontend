# Analytics Events Documentation

本文档记录云打印项目的所有遥测事件。

## 事件命名规范

- 使用 `:` 分隔命名空间和动作，如 `printer:list_viewed`
- 动作使用过去时，表示已完成的行为
- 属性名使用 snake_case

## 事件列表

### 打印机与入口

**`printer:list_viewed`** - 打印机列表查看
- 触发时机：进入打印页面，打印机列表加载完成
- 属性：
  - `printer_count: number` - 可用打印机数量

**`printer:viewed`** - 打印机详情查看
- 触发时机：选择特定打印机
- 属性：
  - `printer_id: string`
  - `duplex_mode: string`
  - `has_active_warning: boolean`

**`printer:active_warning_shown`** - 打印机忙碌警告显示
- 触发时机：选中的打印机有活跃任务时显示警告
- 属性：
  - `printer_id: string`
  - `warning_type: 'printing' | 'manual_duplex'`

**`printer:active_warning_ignored`** - 忽略警告继续
- 触发时机：用户选择忽略警告，继续使用该打印机
- 属性：
  - `printer_id: string`
  - `warning_type: string`

**`printer:active_warning_back`** - 警告后返回
- 触发时机：用户看到警告后选择返回列表
- 属性：
  - `printer_id: string`
  - `warning_type: string`

### 预览

**`preview:completed`** - 预览完成（成功/失败）
- 触发时机：PDF 预览加载结束
- 属性：
  - `source: 'file' | 'feishu'`
  - `batch: boolean`
  - `duplex: 'off' | 'auto' | 'manual'`
  - `nup: number`
  - `success: boolean`
  - `duration_ms?: number` - 仅成功时
  - `page_count_bucket?: string` - 仅成功时，值: `1 | 2-5 | 6-20 | 21-100 | 101+`
  - `error_type?: string` - 仅失败时，值: `timeout | unsupported | conversion | network | unknown`

### 打印提交

**`print:submitted`** - 打印任务提交
- 触发时机：用户点击打印按钮，请求完成（成功/失败）
- 属性：
  - `source: 'file' | 'feishu'`
  - `batch: boolean`
  - `batch_type: 'none' | 'image' | 'doc'`
  - `file_type: string` - 扩展名（如 pdf/docx/jpg）
  - `copies: number`
  - `duplex: 'off' | 'auto' | 'manual'`
  - `nup: number`
  - `page_range: 'all' | 'odd' | 'even' | 'custom'`
  - `scale_bucket: string` - 值: `<100 | 100 | >100`
  - `success: boolean`
  - `manual_duplex?: boolean` - 仅成功时
  - `error_type?: string` - 仅失败时，值: `forbidden | network | timeout | validation | unknown`

### 手动双面

**`manual_duplex:wait_shown`** - 手动双面等待界面显示
- 触发时机：打印任务返回 hook_url
- 属性：
  - `printer_id: string`
  - `extend_window_seconds?: number`

**`manual_duplex:extend_available`** - 延长窗口可用
- 触发时机：延长按钮变为可点击
- 属性：
  - `printer_id: string`

**`manual_duplex:extend`** - 延长请求发起
- 触发时机：用户点击延长按钮
- 属性：
  - `printer_id: string`
  - `success: boolean`
  - `error_type?: string` - 仅失败时，值: `network | timeout | expired | unknown`

**`manual_duplex:continue`** - 继续第二面打印
- 触发时机：用户点击继续按钮
- 属性：
  - `printer_id: string`

**`manual_duplex:cancel`** - 取消手动双面
- 触发时机：用户点击取消按钮
- 属性：
  - `printer_id: string`

**`manual_duplex:expired_client`** - 客户端超时
- 触发时机：倒计时归零，客户端判定超时
- 属性：
  - `printer_id: string`

### 批量打印

**`batch:enabled`** - 批量模式启用
- 触发时机：检测到多文件，进入批量模式
- 属性：
  - `batch_type: 'image' | 'doc'`

**`batch:file_added`** - 批量文件添加
- 触发时机：批量模式下添加文件
- 属性：
  - `batch_type: string`
  - `count_bucket: string` - 当前批量文件数量区间，值: `1 | 2-3 | 4-10 | 11-20 | 21+`

**`batch:completed`** - 批量打印完成
- 触发时机：批量打印所有任务结束
- 属性：
  - `batch_type: string`
  - `file_count_bucket: string` - 值: `1 | 2-3 | 4-10 | 11-20 | 21+`
  - `success_count: number`
  - `failed_count: number`

### 飞书文档

**`feishu_picker:opened`** - 飞书文档选择器打开
- 触发时机：点击"从飞书选择"按钮
- 属性：无

**`feishu_picker:completed`** - 飞书选择器完成
- 触发时机：选择器回调（成功/失败）
- 属性：
  - `success: boolean`
  - `error_type?: string` - 仅失败时，值: `cancel | denied | internal | unknown`

### 扫描功能

**`scan:device_discovered`** - 扫描设备发现
- 触发时机：扫描设备列表更新
- 属性：
  - `count: number` - 发现的设备数量

**`scan:started`** - 扫描开始
- 触发时机：用户点击"开始扫描"按钮
- 属性：无

**`scan:file_downloaded`** - 扫描文件下载
- 触发时机：用户下载扫描的文件
- 属性：无

**`scan:file_deleted`** - 扫描文件删除
- 触发时机：用户删除扫描的文件
- 属性：无

### 认证功能

**`auth:login_success`** - 登录成功
- 触发时机：飞书 OAuth 回调成功，token 获取成功
- 属性：无

**`auth:login_failed`** - 登录失败
- 触发时机：OAuth 流程失败或 token 获取失败
- 属性：
  - `reason?: string` - 失败原因（可选）

### 用户交互

**`ui:language_changed`** - 语言切换
- 触发时机：用户切换界面语言
- 属性：
  - `language: string` - 语言代码 (zh/en)

## 数据隐私

所有事件均不包含：
- 用户个人身份信息
- 文件内容或文件名
- IP 地址或设备标识
- 打印机完整信息（仅 ID）

## 技术实现

- **平台**: Umami Analytics
- **SDK**: 通过全局 `umami.track()` 方法调用
- **数据流**: 浏览器 → Umami 云服务（不经过后端）
- **加载方式**: `<script defer>` 异步加载，不阻塞页面渲染
- **失败处理**: Umami 不可用时静默失败，不影响功能
