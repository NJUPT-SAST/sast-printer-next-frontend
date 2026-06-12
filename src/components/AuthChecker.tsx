import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { track } from "@/lib/analytics";

export default function AuthChecker({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const isLoggingIn = useRef(false);

  useEffect(() => {
    const handleAuth = async () => {
      // 1. Check for code in URL (OAuth callback)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");

      if (code) {
        if (isLoggingIn.current) return;
        isLoggingIn.current = true;
        try {
          // Exchange code for session (backend sets session cookie)
          await api.post("/auth/config/code-login", { code });
          window.dispatchEvent(new Event("auth-changed"));
          // Remove code from URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
          setIsAuthenticated(true);
          track.authLoginSuccess();
        } catch (err) {
          console.error("Login failed", err);
          setError("登录失败，请重新进入应用");
          // Clear URL so refreshing works
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
          track.authLoginFailed("code_exchange_failed");
        } finally {
          isLoggingIn.current = false;
        }
        return;
      }

      // 2. Check if already authenticated via session
      try {
        // Call a lightweight endpoint to verify session
        await api.get("/auth/session");
        setIsAuthenticated(true);
        return;
      } catch {
        // Not authenticated, continue to redirect
      }

      // 3. Need to redirect to Feishu OAuth
      try {
        const confRes = await api.get("/auth/config");
        const appId = confRes.data.app_id;

        if (!appId) {
          setError("未配置飞书 App ID");
          return;
        }

        const redirectUri = encodeURIComponent(
          window.location.protocol +
            "//" +
            window.location.host +
            window.location.pathname,
        );
        // 使用标准的网页应用/H5 OAuth 2.0 登录链接
        const authUrl = `https://passport.feishu.cn/suite/passport/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&response_type=code`;

        window.location.href = authUrl;
      } catch (err) {
        console.error("Failed to get auth config", err);
        setError("无法加载应用配置");
      }
    };

    handleAuth();
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重新尝试
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <p className="text-gray-500 font-medium tracking-wide">
            正在飞书免登授权中...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
