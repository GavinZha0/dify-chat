import { initResponsiveConfig } from '@dify-chat/helpers'
import { useThemeContext } from '@dify-chat/theme'
import { theme as antdTheme, ConfigProvider } from 'antd'
import zhCN from 'antd/es/locale/zhCN'
import en_US from 'antd/es/locale/en_US'
import { BrowserRouter, type IRoute } from 'pure-react-router'

import './App.css'
import LayoutIndex from './layout'
import AppListPage from './pages/apps'
import AuthPage from './pages/auth'
import ChatPage from './pages/chat'
import { LanguageProvider } from '@/language/language-context.tsx'

// 初始化响应式配置
initResponsiveConfig()

const routes: IRoute[] = [
	{ path: '/auth', component: () => <AuthPage /> },
	{ path: '/chat', component: () => <ChatPage /> },
	{ path: '/app/:appId', component: () => <ChatPage /> },
	{ path: '/apps', component: () => <AppListPage /> },
]

/**
 * Dify Chat 的最小应用实例
 */
export default function App() {
	const { isDark } = useThemeContext()

	return (
		<ConfigProvider
			locale={en_US}
			theme={{
				algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
			}}
		>
			<BrowserRouter
				basename="/dify-chat"
				routes={routes}
			>
				<LanguageProvider>
					<LayoutIndex />
				</LanguageProvider>
			</BrowserRouter>
		</ConfigProvider>
	)
}
