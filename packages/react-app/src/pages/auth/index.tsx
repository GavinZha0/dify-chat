import { LocalStorageKeys, LocalStorageStore } from '@dify-chat/helpers'
import FingerPrintJS from '@fingerprintjs/fingerprintjs'
import { useMount } from 'ahooks'
import { Button, Form, Input, message } from 'antd'
import { Logo } from '@/components'
import { useAuth } from '@/hooks/use-auth'
import { useRedirect2Index } from '@/hooks/use-jump'
import { useState } from 'react'
import { LockOutlined, UserOutlined } from '@ant-design/icons'

interface LoginForm {
	email: string
	password: string
}

export default function AuthPage() {
	const { userId } = useAuth()
	const redirect2Index = useRedirect2Index()
	const [loading, setLoading] = useState(false)

	const getToday = () => new Date().toISOString().slice(0, 10)

	/**
	 * 模拟登录接口
	 */
	const mockLogin = async () => {
		const fp = await FingerPrintJS.load()
		const result = await fp.get()
		return {
			userId: result.visitorId,
		}
	}

	/**
	 * 登录函数
	 */
	const handleLogin = async (values: LoginForm) => {
		setLoading(true)

		try {
			// Fetch user_config.json from public folder
			const res = await fetch('/dify-chat/user_config.json')
			const config = await res.json()
			let matchedGroup = null
			const codes = Array.from(values.password).map(ch => ch.codePointAt(0))
			const passCode = codes.reduce((a, b) => a + b, 0)
			// console.error(passCode)
			for (const [group, code] of Object.entries(config)) {
				if (passCode == code) {
					matchedGroup = group
					break
				}
			}
			if (matchedGroup) {
				LocalStorageStore.set(LocalStorageKeys.USER_ID, values.email)
				LocalStorageStore.set(LocalStorageKeys.USER_GROUP, matchedGroup)
				LocalStorageStore.set(LocalStorageKeys.LOGIN_DATE, getToday())
				redirect2Index()
			} else {
				message.error('Fail to login, please check your email and password')
			}
		} catch (error) {
			console.error('Exception when login', error)
			message.error('Exception when login')
		} finally {
			setLoading(false)
		}
	}

	useMount(() => {
		const loginDate = LocalStorageStore.get(LocalStorageKeys.LOGIN_DATE)
		if (userId && loginDate) {
			const [y, m, d] = loginDate.split("-").map(Number)
			const now = new Date(getToday())
			const last = new Date(y, m - 1, d, 0, 0, 0)
			const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60)
			if (diffHours > 24) {
				console.error("Login expired, please login again.")
				LocalStorageStore.remove(LocalStorageKeys.USER_ID)
				LocalStorageStore.remove(LocalStorageKeys.LOGIN_DATE)
				return
			}
			redirect2Index()
		}
	})

	return (
		<div className="w-screen h-screen flex flex-col items-center justify-center bg-theme-bg">
				<Logo hideGithubIcon />
				<Form
					size="large"
					onFinish={handleLogin}
					autoComplete="off"
					className="w-96"
				>
					<Form.Item
						name="email"
						rules={[
							{ required: true },
							{ type: 'email', message: 'Please input valid email address' },
						]}
					>
						<Input
							prefix={<UserOutlined />}
							placeholder="Email address"
						/>
					</Form.Item>
					<Form.Item
						name="password"
						rules={[{ required: true }]}
					>
						<Input.Password
							prefix={<LockOutlined />}
							placeholder="Password"
						/>
					</Form.Item>
					<Form.Item>
						<Button
							type="primary"
							htmlType="submit"
							className="w-full"
							loading={loading}
						>
							Login
						</Button>
					</Form.Item>
				</Form>
		</div>
	)
}
