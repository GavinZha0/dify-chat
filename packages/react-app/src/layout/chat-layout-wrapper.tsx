import { DownCircleTwoTone } from '@ant-design/icons'
import {
	AppContextProvider,
	DEFAULT_APP_SITE_SETTING,
	ICurrentApp,
	IDifyAppItem,
} from '@dify-chat/core'
import { useIsMobile } from '@dify-chat/helpers'
import { useMount, useRequest } from 'ahooks'
import { Dropdown, message } from 'antd'
import { useHistory, useParams } from 'pure-react-router'
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

import { LucideIcon } from '@/components'
import { isDebugMode } from '@/components/debug-mode'
import { useAuth } from '@/hooks/use-auth'
import appService from '@/services/app'
import { createDifyApiInstance, DifyApi } from '@/utils/dify-api'

import MainLayout from './main-layout'
import { useLanguage } from '@/language/language-context.tsx'

const MultiAppLayout = () => {
	const history = useHistory()
	const { userId } = useAuth()
	const { t } = useLanguage()

	const [difyApi] = useState(
		createDifyApiInstance({
			user: userId,
			apiBase: '',
			apiKey: '',
		}),
	)

	const [selectedAppId, setSelectedAppId] = useState<string>('')
	const [initLoading, setInitLoading] = useState(false)
	const [appList, setAppList] = useState<IDifyAppItem[]>([])

	const { appId } = useParams<{ appId: string }>()
	const [currentApp, setCurrentApp] = useState<ICurrentApp>()

	const { runAsync: getAppList } = useRequest(
		() => {
			setInitLoading(true)
			return appService.getApps()
		},
		{
			manual: true,
			onSuccess: result => {
				flushSync(() => {
					setAppList(result)
				})
				if (isMobile) {
					// 移动端如果没有应用，直接跳转应用列表页
					if (!result?.length) {
						history.replace('/apps')
						return Promise.resolve([])
					}
				}

				if (appId) {
					setSelectedAppId(appId as string)
				} else if (!selectedAppId && result?.length) {
					setSelectedAppId(result[0]?.id || '')
				}
			},
			onError: error => {
				message.error(`Fail to get apps: ${error}`)
				console.error(error)
			},
			onFinally: () => {
				setInitLoading(false)
			},
		},
	)

	const { runAsync: getAppParameters } = useRequest(
		(difyApi: DifyApi) => {
			return difyApi.getAppParameters()
		},
		{
			manual: true,
		},
	)

	const { runAsync: getAppSiteSettting } = useRequest(
		(difyApi: DifyApi) => {
			return difyApi
				.getAppSiteSetting()
				.then(res => {
					return res
				})
				.catch(err => {
					console.error(err)
					console.warn(
						'Fail to get apps, please confirm Dify >= v1.4.0',
					)
					return DEFAULT_APP_SITE_SETTING
				})
		},
		{
			manual: true,
		},
	)

	/**
	 * 初始化应用信息
	 */
	const initApp = async () => {
		const appItem = await appService.getAppByID(selectedAppId)
		if (!appItem) {
			return
		}
		const newOptions = isDebugMode()
			? {
					user: userId,
					...appItem.requestConfig,
				}
			: {
					user: userId,
					...appItem.requestConfig,
					apiBase: `/${selectedAppId}`,
				}
		difyApi.updateOptions(newOptions)
		setInitLoading(true)
		// 获取应用参数
		const getParameters = () => getAppParameters(difyApi)
		const getSiteSetting = () => getAppSiteSettting(difyApi)
		const promises = [getParameters(), getSiteSetting()] as const
		Promise.all(promises)
			.then(res => {
				const [parameters, siteSetting] = res
				setCurrentApp({
					config: appItem,
					parameters: parameters!,
					site: siteSetting,
				})
			})
			.catch(err => {
				message.error(`Fail to get parameters: ${err}`)
				console.error(err)
				setCurrentApp(undefined)
			})
			.finally(() => {
				setInitLoading(false)
			})
	}

	useEffect(() => {
		initApp()
	}, [selectedAppId])

	const isMobile = useIsMobile()

	// 初始化获取应用列表
	useMount(() => {
		getAppList()
	})

	return (
		<AppContextProvider
			value={{
				appLoading: initLoading,
				currentAppId: selectedAppId,
				setCurrentAppId: setSelectedAppId,
				currentApp,
				setCurrentApp,
			}}
		>
			<>
				<MainLayout
					difyApi={difyApi}
					initLoading={initLoading}
					renderCenterTitle={() => {
						return (
							<div className="flex items-center overflow-hidden">
								<LucideIcon
									name="layout-grid"
									size={16}
									className="mr-1"
								/>
								<span
									className="cursor-pointer inline-block shrink-0"
									onClick={() => {
										history.push('/apps')
									}}
								>
									{t('Apps')}
								</span>
								{selectedAppId ? (
									<div className="flex items-center overflow-hidden">
										<div className="mx-2 font-normal text-desc">/</div>
										<Dropdown
											arrow
											placement="bottom"
											trigger={['click']}
											menu={{
												selectedKeys: [selectedAppId],
												items: [
													...(appList?.map(item => {
														const isSelected = selectedAppId === item.id
														return {
															key: item.id,
															label: (
																<div className={isSelected ? 'text-primary' : 'text-theme-text'}>
																	{item.info.name}
																</div>
															),
															onClick: () => {
																history.push(`/app/${item.id}`)
																setSelectedAppId(item.id)
															},
															icon: (
																<LucideIcon
																	name="bot"
																	size={18}
																/>
															),
														}
													}) || []),
												],
											}}
										>
											<div className="cursor-pointer flex-1 flex items-center overflow-hidden">
												<span className="cursor-pointer w-full inline-block truncate">
													{currentApp?.config?.info?.name}
												</span>
											</div>
										</Dropdown>
									</div>
								) : null}
							</div>
						)
					}}
				/>
			</>
		</AppContextProvider>
	)
}

export default MultiAppLayout
