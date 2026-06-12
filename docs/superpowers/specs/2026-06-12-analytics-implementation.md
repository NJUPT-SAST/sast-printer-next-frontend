# Analytics Implementation Summary

## 已完成的集成

### 1. 基础设施
- ✅ 在 `index.html` 添加 Umami 脚本（使用 `defer` 异步加载）
- ✅ 创建 `src/lib/analytics.ts` 统一管理所有遥测事件
- ✅ 实现 bucket 函数用于数据分组（pageCount, fileCount, scale）

### 2. 已集成的事件（全部完成）

#### 打印机选择 (5/5)
- ✅ `printer:list_viewed` - 打印机列表查看
- ✅ `printer:viewed` - 打印机详情查看
- ✅ `printer:active_warning_shown` - 打印机忙碌警告显示
- ✅ `printer:active_warning_ignored` - 忽略警告继续
- ✅ `printer:active_warning_back` - 警告后返回

#### 预览 (1/1)
- ✅ `preview:completed` - 预览完成（成功/失败，含性能数据）

#### 打印提交 (1/1)
- ✅ `print:submitted` - 打印任务提交（成功/失败，包含所有关键参数）

#### 手动双面 (6/6)
- ✅ `manual_duplex:wait_shown` - 手动双面等待界面显示
- ✅ `manual_duplex:extend_available` - 延长窗口可用
- ✅ `manual_duplex:extend` - 延长请求（成功/失败）
- ✅ `manual_duplex:continue` - 继续第二面打印
- ✅ `manual_duplex:cancel` - 取消手动双面
- ✅ `manual_duplex:expired_client` - 客户端超时

#### 批量打印 (3/3)
- ✅ `batch:enabled` - 批量模式启用
- ✅ `batch:file_added` - 批量文件添加
- ✅ `batch:completed` - 批量打印完成

#### 飞书功能 (2/2)
- ✅ `feishu_picker:opened` - 打开飞书文档选择器
- ✅ `feishu_picker:completed` - 飞书选择器完成（成功/失败）

#### 扫描功能 (4/4)
- ✅ `scan:device_discovered` - 扫描设备发现
- ✅ `scan:started` - 扫描开始
- ✅ `scan:file_downloaded` - 扫描文件下载
- ✅ `scan:file_deleted` - 扫描文件删除

#### 认证功能 (2/2)
- ✅ `auth:login_success` - 登录成功
- ✅ `auth:login_failed` - 登录失败

#### UI 交互 (1/1)
- ✅ `ui:language_changed` - 语言切换

**总计：25/25 事件已完成集成** ✅

## 集成位置

| 文件 | 已集成事件 |
|------|-----------|
| `src/pages/Printers.tsx` | 打印机选择、预览、打印提交、手动双面、批量打印、飞书选择器 |
| `src/components/PrinterList.tsx` | 打印机列表查看 |
| `src/pages/Scanner.tsx` | 扫描功能 |
| `src/components/AuthChecker.tsx` | 认证 |
| `src/lib/i18n.tsx` | 语言切换 |

## 关键实现细节

### 预览事件
- 记录预览加载时长（`performance.now()`）
- 页数分组（1, 2-5, 6-20, 21-100, 101+）
- 错误类型分类（timeout, unsupported, conversion, network, unknown）

### 批量打印
- 自动检测批量模式启用（多文件上传）
- 追踪文件添加到批量列表
- 完成时记录成功/失败数量

### 手动双面
- 等待界面显示时触发 `wait_shown`
- 倒计时进入延长窗口时触发 `extend_available`
- 客户端判定超时时触发 `expired_client`

### 打印机警告
- 区分警告类型（printing / manual_duplex）
- 追踪用户选择（忽略 / 返回）

## 测试方法

1. 启动开发服务器：`pnpm dev`
2. 打开浏览器开发者工具 Network 面板
3. 筛选请求 URL 包含 `umami` 或 `cloud.umami.is`
4. 执行各功能操作，观察发送的事件及其属性

示例事件负载：
```json
{
  "name": "print:submitted",
  "data": {
    "source": "file",
    "batch": false,
    "batch_type": "none",
    "file_type": "pdf",
    "copies": 1,
    "duplex": "auto",
    "nup": 1,
    "page_range": "all",
    "scale_bucket": "100",
    "success": true,
    "manual_duplex": false
  }
}
```

## 注意事项

- 所有遥测调用都是可选的（使用 `umami?.track()`），Umami 不可用时不影响功能
- `defer` 属性确保脚本不阻塞页面渲染
- 不追踪任何敏感信息（用户身份、文件名、文件内容）
- 数据直接发送到 Umami 云服务，不经过后端
- 数值属性使用 bucket 函数分组，避免高基数问题

## 部署后验证

部署到生产环境后，在 Umami 控制台验证：
1. 访问 https://cloud.umami.is
2. 选择项目 (website-id: 80629102-265e-4043-a482-e9be9782e8e6)
3. 检查"实时"页面确认事件正在接收
4. 查看"事件"页面确认所有 25 个事件类型都有数据
