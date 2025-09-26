import { TagOutlined } from '@ant-design/icons'
import { AppModeLabels } from '@dify-chat/core'
import { LocalStorageKeys, LocalStorageStore, useIsMobile } from '@dify-chat/helpers'
import { useRequest } from 'ahooks'
import { Col, Empty, message, Row } from 'antd'
import { useHistory } from 'pure-react-router'

import { DebugMode, HeaderLayout, LucideIcon } from '@/components'
import appService from '@/services/app'
import { useLanguage } from '@/language/language-context.tsx'

export default function AppListPage() {
	const history = useHistory()
	const isMobile = useIsMobile()
	const { t } = useLanguage()

	const { data: list } = useRequest(
		async () => {
			const loginDate = LocalStorageStore.get(LocalStorageKeys.LOGIN_DATE)
			if (loginDate) {
				const [y, m, d] = loginDate.split("-").map(Number)
				const now = new Date()
				const last = new Date(y, m - 1, d, 0, 0, 0)
				const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60)
				if (diffHours > 24) {
					// console.error('Login expired')
					LocalStorageStore.remove(LocalStorageKeys.USER_ID)
					LocalStorageStore.remove(LocalStorageKeys.LOGIN_DATE)
					// enforce to log in
					window.location.replace('/dify-chat/auth')
					return []
				}
			} else {
				// enforce to log in
				window.location.replace('/dify-chat/auth')
				return []
			}
			return await appService.getApps()
		},
		{
			onError: error => {
				message.error(`Fail to get apps: ${error}`)
				console.error(error)
			},
		},
	)

	return (
		<div className="h-screen relative overflow-hidden flex flex-col bg-theme-bg w-full">
			<HeaderLayout
				title={
					<div className="flex items-center">
						<LucideIcon
							name="layout-grid"
							size={16}
							className="mr-1"
						/>
						{t('Applications')}
					</div>
				}
			/>
			<div className="flex-1 bg-theme-main-bg rounded-t-3xl py-6 overflow-y-auto box-border overflow-x-hidden">
				{list?.length ? (
					<Row
						gutter={[16, 16]}
						className="px-3 md:px-6"
					>
						{list.map(item => {
							if (!item.info) {
								return (
									<Col
										key={item.id}
										span={isMobile ? 24 : 6}
									>
										<div
											key={item.id}
											className={`relative group p-3 bg-theme-btn-bg border border-solid border-theme-border rounded-2xl cursor-pointer hover:border-primary hover:text-primary`}
										>
											No app info
										</div>
									</Col>
								)
							}
							const hasTags = item.info.tags?.length
							return (
								<Col
									key={item.id}
									span={isMobile ? 24 : 6}
								>
									<div
										key={item.id}
										className={`relative group p-3 bg-theme-btn-bg border border-solid border-theme-border rounded-2xl cursor-pointer hover:border-primary hover:text-primary
      								${item.isEnabled === 0 ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}
									>
										<div
											onClick={() => {
												if (item.isEnabled !== 0) {
													history.push(`/app/${item.id}`)
												}
											}}
											style={item.isEnabled === 0 ? { pointerEvents: 'none' } : {}}
										>
											<div className="flex items-center overflow-hidden">
												<div className="h-10 w-10 bg-[#ffead5] dark:bg-transparent border border-solid border-transparent dark:border-theme-border rounded-lg flex items-center justify-center">
													<LucideIcon
														name="bot"
														className="text-xl text-theme-text"
													/>
												</div>
												<div className="flex-1 overflow-hidden ml-3 text-theme-text h-10 flex flex-col justify-between">
													<div className="truncate font-semibold pr-4">{item.info.name}</div>
													<div className="text-theme-desc text-xs mt-0.5">
														{item.info.mode ? AppModeLabels[item.info.mode] : 'unknown'}
													</div>
												</div>
											</div>
											<div className="text-sm mt-3 h-10 overflow-hidden text-ellipsis leading-5 whitespace-normal line-clamp-2 text-theme-desc">
												{item.info.description || 'No description'}
											</div>
										</div>
										<div className="flex items-center text-desc truncate mt-3 h-4">
											{hasTags ? (
												<>
													<TagOutlined className="mr-2" />
													{item.info.tags.join(', ')}
												</>
											) : null}
										</div>
									</div>
								</Col>
							)
						})}
					</Row>
				) : (
					<div className="w-full h-full box-border flex flex-col items-center justify-center px-3">
						<Empty description="No applications" />
					</div>
				)}
			</div>
			<DebugMode />
		</div>
	)
}
