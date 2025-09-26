import { BugOutlined, SettingOutlined, ClearOutlined, CloseOutlined, SaveOutlined } from '@ant-design/icons'
import { createDifyApiInstance } from '@dify-chat/api'
import { IDifyAppItem } from '@dify-chat/core'
import { generateUuidV4 } from '@dify-chat/helpers'
import { useRequest } from 'ahooks'
import { Button, Drawer, FloatButton, Form, Input, message, Space, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import { LocalStorageKeys, LocalStorageStore } from '@dify-chat/helpers';

const { TextArea } = Input
const { Text } = Typography

// localStorage 键名
const DEBUG_APPS_KEY = '__DC__DEBUG_APPS'
const DEBUG_MODE_KEY = '__DC__DEBUG_MODE'

interface DebugModeProps {
	className?: string
}

/**
 * 检查URL参数是否开启调试模式
 */
const isDebugModeFromURL = (): boolean => {
	const urlParams = new URLSearchParams(window.location.search)
	return urlParams.get('isDebug') === 'true'
}

/**
 * 调试模式组件
 */
const DebugMode: React.FC<DebugModeProps> = ({ className }) => {
	const [drawerOpen, setDrawerOpen] = useState(false)
	const [form] = Form.useForm()

	// 检查是否应该显示调试按钮
	const shouldShowDebugButton = isDebugMode()
	const hasDebugFromUrl = isDebugModeFromURL()

	useEffect(() => {
		if (hasDebugFromUrl) {
			sessionStorage.setItem(DEBUG_MODE_KEY, 'true')
		}
	}, [hasDebugFromUrl])

	useEffect(() => {
		if (drawerOpen) {
			// 打开抽屉时，加载当前的调试配置
			getDebugApps().then(debugApps => {
				if (debugApps.length > 0) {
					form.setFieldsValue({
						debugApps: JSON.stringify(debugApps, null, 2),
					})
				}
			})
		}
	}, [drawerOpen, form])

	const { loading: saveDebugAppsLoading, runAsync: saveDebugApps } = useRequest(
		async (debugAppsText: string) => {
			// 验证 JSON 格式
			return new Promise((resolve, reject) => {
				const apps = JSON.parse(debugAppsText)

				// 验证应用配置格式
				if (!Array.isArray(apps)) {
					throw new Error('Must be array')
				}

				// 为每个应用添加 ID（如果没有的话）
				const appsWithId = apps.map(app => ({
					...app,
					id: app.id || generateUuidV4(),
				}))
				const appInfoMap = new Map()
				// 遍历配置列表，根据 requestConfig 获取应用基本信息
				const appInfoPromised = appsWithId?.map(item => {
					const appDifyApi = createDifyApiInstance(item.requestConfig)
					return () =>
						appDifyApi.getAppInfo().then(res => {
							appInfoMap.set(item.id, res)
						})
				})
				Promise.all(appInfoPromised.map(item => item()))
					.then(() => {
						appsWithId.forEach(item => {
							item.info = appInfoMap.get(item.id)
						})
						localStorage.setItem(DEBUG_APPS_KEY, JSON.stringify(appsWithId))
						resolve()
					})
					.catch(err => {
						reject(err)
					})
			}) as Promise<void>
		},
		{
			manual: true,
			onSuccess: () => {
				message.success('Saved')
				setTimeout(() => {
					// 刷新页面以应用新配置
					window.location.href = '/dify-chat'
				}, 1000)
			},
		},
	)

	/**
	 * 保存调试配置
	 */
	const handleSaveConfig = async () => {
		try {
			const values = await form.validateFields()
			const debugAppsText = values.debugApps?.trim()

			if (!debugAppsText) {
				localStorage.removeItem(DEBUG_APPS_KEY)
				message.success('Cleaned up')
				setTimeout(() => {
					window.location.href = '/dify-chat'
				}, 1000)
				return
			}

			await saveDebugApps(debugAppsText)
		} catch (error) {
			message.error(`format issue: ${error instanceof Error ? error.message : 'Unknown issue'}`)
		}
	}

	/**
	 * 获取默认配置模板
	 */
	const getDefaultConfig = () => {
		return JSON.stringify(
			[
				{
					requestConfig: {
						apiBase: 'https://api.dify.ai/v1',
						apiKey: 'app-your-api-key-here',
					},
				},
			] as IDifyAppItem[],
			null,
			2,
		)
	}

	// 如果URL中没有isDebug=true参数，不显示调试按钮
	// Hide debug button
	if (!shouldShowDebugButton) {
		return null
	}
	// 如果不是从URL进入调试模式，不显示调试按钮
	if (!isDebugModeUrl()) {
		return null
	}

	return (
		<>
			<Button
				className={className}
				icon={<SettingOutlined />}
				onClick={() => setDrawerOpen(true)}
				tooltip="Debug mode"
				type="primary"
			/>

			<Drawer
				title={
					<div className="flex items-center">
						<SettingOutlined className="mr-2" />
						App config
					</div>
				}
				width={600}
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				extra={
					<Button
						icon={<CloseOutlined />}
						onClick={() => setDrawerOpen(false)}
					>
						Close
					</Button>
				}
			>
				<div className="space-y-6">
					{/* 应用配置编辑 */}
					<div>
						<div className="font-semibold text-base">App config</div>
						<Text
							type="secondary"
							className="block mb-3"
						>
							Json with id, info, requestConfig.
						</Text>

						<Form
							form={form}
							layout="vertical"
						>
							<Form.Item
								name="debugApps"
								rules={[
									{
										validator: async (_, value) => {
											if (!value?.trim()) return
											try {
												const parsed = JSON.parse(value)
												if (!Array.isArray(parsed)) {
													throw new Error('Must be array')
												}
											} catch {
												throw new Error('invalid Json')
											}
										},
									},
								]}
							>
								<TextArea
									rows={15}
									placeholder={getDefaultConfig()}
									className="font-mono text-sm"
								/>
							</Form.Item>
						</Form>

						<Space className="w-full justify-between">
							<Button
								onClick={() => {
									form.setFieldsValue({
										debugApps: getDefaultConfig(),
									})
								}}
							>
								Show example
							</Button>
							<Button
								type="default"
								icon={<ClearOutlined />}
								onClick={() => {
									localStorage.removeItem(DEBUG_APPS_KEY)
									sessionStorage.removeItem(DEBUG_MODE_KEY)
									message.success('Cleaned up')
									setTimeout(() => {
										window.location.href = '/dify-chat'
									}, 1000)
								}}
							>
								{isAlwaysDebugMode() ? 'Clean' : 'Exit'}
							</Button>
							<Button
								type="primary"
								icon={<SaveOutlined />}
								loading={saveDebugAppsLoading}
								onClick={handleSaveConfig}
							>
								Apply
							</Button>
						</Space>
					</div>

					{/* 使用说明 */}
					<div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
						<div className="font-semibold !mb-2 text-base">Instruction</div>
						<div className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
							<div>
								• Follow the specification {' '}
								<span className="font-mono">
									<a target="_blank">IDifyAppItem</a>
								</span>
							</div>
							<div>• Page will be refreshed after config is applied</div>
						</div>
					</div>
				</div>
			</Drawer>
		</>
	)
}

/**
 * 检查是否固定调试模式
 * 当环境变量中设置了 PUBLIC_DEBUG_MODE 为 true 时，调试模式固定为开启状态，不可退出
 */
export const isAlwaysDebugMode = (): boolean => {
	return process.env.PUBLIC_DEBUG_MODE === 'true'
}

/**
 * 获取调试模式状态
 */
export const isDebugMode = (): boolean => {
	// 如果环境变量中设置了调试模式，则固定返回 true
	if (isAlwaysDebugMode()) {
		return true
	}
	// 否则，从 URL 或者 SessionStorage 中读取
	return sessionStorage.getItem(DEBUG_MODE_KEY) === 'true' || isDebugModeFromURL()
}


export const isDebugModeUrl = (): boolean => {
	return isDebugModeFromURL()
}

/**
 * 获取调试应用配置
 */
export const getDebugApps = async (): Promise<IDifyAppItem[]> => {
	if (!isDebugMode()) {
		return []
	}

	const debugApps = localStorage.getItem(DEBUG_APPS_KEY)
	if (!debugApps) {
		return []
	}

	try {
		// return JSON.parse(debugApps)
		const userGroup = LocalStorageStore.get(LocalStorageKeys.USER_GROUP)
		const appCfg = await fetch('/dify-chat/app_config.json')
		if (!appCfg.ok) {
			console.error('Failed to fetch app_config.json')
		}
		const appInfo = await appCfg.json()
		const licensedApps = []
		for(const app of appInfo) {
			if(app.info.tags.includes(userGroup)) {
				// enable the app if group matches
				// enable all apps for group ADM
				licensedApps.push(app)
			}
		}
		return licensedApps
	} catch (err) {
		console.error('Fail to parse app config:', err)
		return []
	}
}

export default DebugMode
