# Session-Based Authentication Migration

## 概述

将认证机制从 Bearer Token 改为基于 Cookie 的 Session 认证，符合飞书的最佳实践。

## 前端改动

### 1. API 客户端 (`src/lib/utils.ts`)
- 移除 `Authorization: Bearer` header
- 添加 `withCredentials: true` 配置，允许跨域请求携带 cookie
- 移除 token 相关的 localStorage 操作

### 2. AuthChecker 组件 (`src/components/AuthChecker.tsx`)
- 移除 `localStorage.getItem("token")` 检查
- 移除 `localStorage.setItem("token", ...)` 存储
- 添加 `GET /auth/session` 调用验证现有 session
- OAuth 回调后不再存储 token，依赖后端设置的 session cookie

### 3. 优势
- 更安全：HttpOnly cookie 无法被 JavaScript 访问，防止 XSS 攻击
- 符合最佳实践：飞书官方推荐使用 session 而非 token
- 简化代码：无需手动管理 token 生命周期

## 后端需要的改动

### 1. 启用 CORS 并支持凭据

```go
// 示例：使用 gin 框架
router.Use(cors.New(cors.Config{
    AllowOrigins:     []string{"https://your-frontend-domain.com"},
    AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowHeaders:     []string{"Content-Type"},
    AllowCredentials: true, // 关键：允许跨域请求携带 cookie
}))
```

### 2. Session 中间件

使用 session 存储（推荐 Redis）：

```go
import (
    "github.com/gin-contrib/sessions"
    "github.com/gin-contrib/sessions/redis"
)

store, _ := redis.NewStore(10, "tcp", "localhost:6379", "", []byte("secret"))
store.Options(sessions.Options{
    Path:     "/",
    MaxAge:   86400 * 7, // 7 天
    HttpOnly: true,      // 防止 XSS
    Secure:   true,      // 仅 HTTPS (生产环境)
    SameSite: http.SameSiteNoneMode, // 允许跨域
})
router.Use(sessions.Sessions("session", store))
```

### 3. 修改 `/auth/config/code-login` 端点

**Before (返回 token):**
```go
func CodeLogin(c *gin.Context) {
    // ... OAuth code exchange ...
    
    token := generateJWT(userID)
    c.JSON(200, gin.H{
        "access_token": token,
    })
}
```

**After (设置 session):**
```go
func CodeLogin(c *gin.Context) {
    // ... OAuth code exchange ...
    
    session := sessions.Default(c)
    session.Set("user_id", userID)
    session.Set("open_id", openID)
    session.Set("tenant_key", tenantKey)
    session.Save()
    
    c.JSON(200, gin.H{
        "message": "Login successful",
    })
}
```

### 4. 新增 `/auth/session` 端点

用于验证现有 session 是否有效：

```go
func CheckSession(c *gin.Context) {
    session := sessions.Default(c)
    userID := session.Get("user_id")
    
    if userID == nil {
        c.JSON(401, gin.H{"error": "Unauthorized"})
        return
    }
    
    c.JSON(200, gin.H{
        "authenticated": true,
        "user_id": userID,
    })
}
```

### 5. 更新认证中间件

**Before (验证 Bearer token):**
```go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        // ... 验证 JWT ...
    }
}
```

**After (验证 session):**
```go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        session := sessions.Default(c)
        userID := session.Get("user_id")
        
        if userID == nil {
            c.JSON(401, gin.H{"error": "Unauthorized"})
            c.Abort()
            return
        }
        
        c.Set("user_id", userID)
        c.Next()
    }
}
```

### 6. 应用中间件到保护的路由

```go
api := router.Group("/api")
api.Use(AuthMiddleware())
{
    api.GET("/printers", GetPrinters)
    api.POST("/jobs", CreateJob)
    // ... 其他需要认证的路由
}

// /auth 路由不需要认证中间件
auth := router.Group("/auth")
{
    auth.GET("/config", GetAuthConfig)
    auth.POST("/config/code-login", CodeLogin)
    auth.GET("/session", CheckSession) // 验证 session 有效性
}
```

## 测试

### 1. 测试登录流程
1. 清除浏览器所有 cookie
2. 访问前端，应自动重定向到飞书 OAuth
3. 授权后回调，检查浏览器是否收到 `Set-Cookie` header
4. 刷新页面，应直接进入应用（不再重定向）

### 2. 测试 Session 验证
```bash
# 获取 session cookie
curl -c cookies.txt 'https://api.example.com/auth/config/code-login' \
  -H 'Content-Type: application/json' \
  -d '{"code":"..."}'

# 使用 cookie 访问保护的端点
curl -b cookies.txt 'https://api.example.com/api/printers'
```

### 3. 测试 Session 过期
1. 登录后等待 session 过期（或手动删除服务器端 session）
2. 刷新页面或发起 API 请求
3. 应收到 401 响应并自动重定向到登录页

## 部署注意事项

### 生产环境配置

1. **HTTPS**: Cookie `Secure` 属性要求必须使用 HTTPS
2. **Domain**: 如果前后端跨子域，设置 cookie domain 为 `.example.com`
3. **SameSite**: 跨域场景使用 `SameSiteNoneMode`，需要 `Secure=true`
4. **Session Store**: 使用 Redis 等持久化存储，支持水平扩展

### 环境变量示例

```env
SESSION_SECRET=your-secret-key-here
SESSION_STORE=redis
REDIS_ADDR=localhost:6379
COOKIE_DOMAIN=.example.com
COOKIE_SECURE=true
```

## 兼容性

- 所有现代浏览器支持
- 不受浏览器 localStorage 限制（某些隐私模式下 localStorage 不可用）
- 支持多标签页自动同步（共享同一 cookie）
