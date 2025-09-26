import { AppstoreOutlined, EditOutlined, MenuOutlined, MessageOutlined, MinusCircleOutlined, PlusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { DifyApi, IConversationItem } from '@dify-chat/api';
import { ConversationsContextProvider, DEFAULT_APP_SITE_SETTING, IDifyAppItem, useAppContext } from '@dify-chat/core';
import { generateUuidV4, isTempId, LocalStorageKeys, LocalStorageStore, useIsMobile } from '@dify-chat/helpers';
import { ThemeModeEnum, ThemeModeLabelEnum, useThemeContext } from '@dify-chat/theme';
import { Button, Dropdown, Empty, Form, GetProp, Input, message, Modal, Popover, Radio, Spin, Tabs, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useSearchParams } from 'pure-react-router';
import { useHistory } from 'pure-react-router';
import React, { useEffect, useMemo, useState } from 'react';



import { AppIcon, ConversationList, LucideIcon } from '@/components';
import { HeaderLayout } from '@/components';
import ChatboxWrapper from '@/components/chatbox-wrapper';
import { DEFAULT_CONVERSATION_NAME } from '@/constants';
import { useLatest } from '@/hooks/use-latest';
import appService from '@/services/app';
import {useLanguage} from "@/language/language-context.tsx";





interface IChatLayoutProps {
	/**
	 * 扩展的 JSX 元素, 如抽屉/弹窗等
	 */
	extComponents?: React.ReactNode
	/**
	 * 自定义中心标题
	 */
	renderCenterTitle?: (appInfo?: IDifyAppItem['info']) => React.ReactNode
	/**
	 * 自定义右侧头部内容
	 */
	renderRightHeader?: () => React.ReactNode
	/**
	 * 是否正在加载应用配置
	 */
	initLoading: boolean
	/**
	 * Dify API 实例
	 */
	difyApi: DifyApi
}

export default function ChatLayout(props: IChatLayoutProps) {
	const { extComponents, renderCenterTitle, initLoading, difyApi } = props
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const { themeMode, setThemeMode } = useThemeContext()
	const { appLoading, currentApp, setCurrentApp } = useAppContext()
	const [renameForm] = Form.useForm()
	const [conversations, setConversations] = useState<IConversationItem[]>([])
	const [currentConversationId, setCurrentConversationId] = useState<string>('')
	const currentConversationInfo = useMemo(() => {
		return conversations?.find(item => item.id === currentConversationId)
	}, [conversations, currentConversationId])
	const isMobile = useIsMobile()
	// 2. Add state for appList and loading
	const [appList, setAppList] = useState<IDifyAppItem[]>([])
	const [appListLoading, setAppListLoading] = useState(false)
	const history = useHistory()

	// 创建 Dify API 实例
	const searchParams = useSearchParams()
	const [conversationListLoading, setCoversationListLoading] = useState<boolean>(false)
	const latestCurrentConversationId = useLatest(currentConversationId)
	const { t } = useLanguage()

	// 3. Fetch appList on mount
	useEffect(() => {
		setAppListLoading(true)
		appService
			.getApps()
			.then(async result => {
				const validApps = []

				for (const item of result) {
					/*
					const newOptions = {
						user: userId,
						apiBase: item.requestConfig.apiBase,
						apiKey: item.requestConfig.apiKey,
					}
					difyApi.updateOptions(newOptions)

					try {
						// get parameters and site settings from Dify
						const [parameters, site] = await Promise.all([
							difyApi.getAppParameters(),
							difyApi.getAppSiteSetting().catch(() => DEFAULT_APP_SITE_SETTING),
						])
						if(parameters && site){
							item.parameters = parameters
							item.site = site
							if (item.isEnabled == undefined){
								item.isEnabled = 1
							}
						} else {
							// disable this app if parameters or site settings are missing
							item.isEnabled = 0
						}
					}
					catch (e) {
						// disable this app if any error occurs
						// console.error(`App ${item.id} is invalid: ${e}`)
						item.isEnabled = 0
					}
					finally {
						validApps.push(item)
					}
					*/

					if (item.isEnabled){
						validApps.push(item)
					}
				}

				setAppList(validApps)
			})
			.catch(error => {
				message.error(`Fail to get apps: ${error}`)
				setAppList([])
			})
			.finally(() => setAppListLoading(false))
	}, [])

	useEffect(() => {
		if (!currentApp?.config) {
			return
		}
		setConversations([])
		setCurrentConversationId('')
		getConversationItems().then(() => {
			const isNewConversation = searchParams.get('isNewCvst') === '1'
			if (isNewConversation) {
				onAddConversation()
			}
		})
	}, [currentApp?.config])


	const handleAppSelect = async (app: IDifyAppItem) => {
		history.push(`/app/${app.id}`)
		try {
			const newOptions = {
				user: userId,
				apiBase: app.requestConfig.apiBase,
				apiKey: app.requestConfig.apiKey,
			};
			difyApi.updateOptions(newOptions);

			const [parameters, site] = await Promise.all([
				difyApi.getAppParameters(),
				difyApi.getAppSiteSetting().catch(() => DEFAULT_APP_SITE_SETTING),
			]);

			setCurrentApp({
				config: app,
				parameters,
				site,
			});
		} catch (error) {
			message.error(`Fail to get app info: ${error}`);
			setCurrentApp(undefined);
		}
	}

	/**
	 * 获取对话列表
	 */
	const getConversationItems = async (showLoading = true) => {
		if (showLoading) {
			setCoversationListLoading(true)
		}
		try {
			const result = await difyApi?.listConversations()
			const newItems =
				result?.data?.map(item => {
					return {
						key: item.id,
						label: item.name,
					}
				}) || []
			setConversations(result?.data)
			// 避免闭包问题
			if (!latestCurrentConversationId.current) {
				if (newItems.length) {
					setCurrentConversationId(newItems[0]?.key)
				} else {
					onAddConversation()
				}
			}
		} catch (error) {
			console.error(error)
			message.error(`Fail to get conversations: ${error}`)
		} finally {
			setCoversationListLoading(false)
		}
	}

	/**
	 * 添加临时新对话(要到第一次服务器响应有效的对话 ID 时才真正地创建完成)
	 */
	const onAddConversation = () => {
		// 创建新对话
		const newKey = `temp_${generateUuidV4()}`
		// 使用函数式更新保证状态一致性（修复潜在竞态条件）
		setConversations(prev => {
			return [
				{
					id: newKey,
					name: DEFAULT_CONVERSATION_NAME,
					created_at: dayjs().valueOf(),
					inputs: {},
					introduction: '',
					status: 'normal',
					updated_at: dayjs().valueOf(),
				},
				...(prev || []),
			]
		})
		setCurrentConversationId(newKey)
	}

	/**
	 * 重命名对话
	 */
	const onRenameConversation = async (conversationId: string, name: string) => {
		await difyApi?.renameConversation({
			conversation_id: conversationId,
			name,
		})
		getConversationItems()
	}

	/**
	 * 重命名会话
	 * @param conversation 会话对象
	 */
	const handleRenameConversation = () => {
		renameForm.setFieldsValue({
			name: currentConversationInfo?.name,
		})
		Modal.confirm({
			centered: true,
			destroyOnClose: true,
			title: 'Edit',
			content: (
				<Form
					form={renameForm}
					className="mt-3"
				>
					<Form.Item name="name">
						<Input placeholder="please input" />
					</Form.Item>
				</Form>
			),
			onOk: async () => {
				await renameForm.validateFields()
				const values = await renameForm.validateFields()
				await onRenameConversation(currentConversationId, values.name)
				message.success('Edited')
			},
		})
	}

	/**
	 * 删除对话
	 */
	const onDeleteConversation = async (conversationId: string) => {
		if (isTempId(conversationId)) {
			setConversations(prev => {
				const newConversations = prev.filter(item => item.id !== conversationId)
				// 删除当前对话
				if (conversationId === currentConversationId) {
					// 如果列表不为空，则选择第一个作为当前对话
					if (newConversations.length) {
						setCurrentConversationId(newConversations[0].id)
					} else {
						// 如果列表为空，则创建一个新的临时对话
						onAddConversation()
					}
				}
				return newConversations
			})
		} else {
			await difyApi?.deleteConversation(conversationId)
			if (conversationId === currentConversationId) {
				setCurrentConversationId('')
			}
			getConversationItems()
			return Promise.resolve()
		}
	}

	const mobileMenuItems: GetProp<typeof Dropdown, 'menu'>['items'] = useMemo(() => {
		const actionMenus: GetProp<typeof Dropdown, 'menu'>['items'] = [
			{
				key: 'add_conversation',
				icon: <PlusCircleOutlined />,
				label: t('New chat'),
				disabled: isTempId(currentConversationId),
				onClick: () => {
					onAddConversation()
				},
			},
			{
				key: 'rename_conversation',
				icon: <EditOutlined />,
				label: t('Edit'),
				disabled: isTempId(currentConversationId),
				onClick: () => {
					handleRenameConversation()
				},
			},
			{
				key: 'delete_conversation',
				icon: <MinusCircleOutlined />,
				label: t('Delete'),
				disabled: isTempId(currentConversationId),
				danger: true,
				onClick: () => {
					Modal.confirm({
						centered: true,
						title: 'Confirm？',
						content: 'Delete conversation',
						okText: 'Delete',
						cancelText: 'Cancel',
						onOk: async () => {
							// 执行删除操作
							await onDeleteConversation(currentConversationId)
							message.success('Deleted')
						},
					})
				},
			},
			{
				type: 'divider',
			},
		]

		const conversationListMenus: GetProp<typeof Dropdown, 'menu'>['items'] = [
			{
				key: 'view-mode',
				type: 'group',
				children: [
					{
						key: 'light',
						label: (
							<Radio.Group
								key="view-mode"
								optionType="button"
								value={themeMode}
								onChange={e => {
									setThemeMode(e.target.value as ThemeModeEnum)
								}}
							>
								<Radio value={ThemeModeEnum.SYSTEM}>{ThemeModeLabelEnum.SYSTEM}</Radio>
								<Radio value={ThemeModeEnum.LIGHT}>{ThemeModeLabelEnum.LIGHT}</Radio>
								<Radio value={ThemeModeEnum.DARK}>{ThemeModeLabelEnum.DARK}</Radio>
							</Radio.Group>
						),
					},
				],
				label: 'Theme',
			},
			{
				type: 'divider',
			},
			{
				type: 'group',
				label: 'Conversations',
				children: conversations?.length
					? conversations.map(item => {
							return {
								key: item.id,
								label: item.name,
								onClick: () => {
									setCurrentConversationId(item.id)
								},
							}
						})
					: [
							{
								key: 'no_conversation',
								label: 'No conversations',
								disabled: true,
							},
						],
			},
		]

		if (isTempId(currentConversationId)) {
			return [...conversationListMenus]
		}

		return [...actionMenus, ...conversationListMenus]
	}, [currentConversationId, conversations, themeMode, setThemeMode])

	// 对话列表（包括加载和缺省状态）
	const conversationListWithEmpty = useMemo(() => {
		return (
			<Spin spinning={conversationListLoading}>
				{conversations?.length ? (
					<div style={{ height: 'calc(100vh - 300px)', overflow: 'auto' }}>
						<ConversationList
							renameConversationPromise={onRenameConversation}
							deleteConversationPromise={onDeleteConversation}
							items={conversations.map(item => ({
								key: item.id,
								label: item.name,
							}))}
							activeKey={currentConversationId}
							onActiveChange={id => setCurrentConversationId(id)}
						/>
					</div>
				) : (
					<div className="w-full h-full flex items-center justify-center">
						<Empty
							className="pt-6"
							description="No conversations"
						/>
					</div>
				)}
			</Spin>
		)
	}, [
		conversations,
		conversationListLoading,
		currentConversationId,
		onRenameConversation,
		onDeleteConversation,
		setCurrentConversationId,
	])

	const disableNewButton = useMemo(() => {
		return conversations?.some(item => isTempId(item.id))
	}, [conversations])


	const [userId, setUserId] = useState<string>('')

	useEffect(() => {
		const storedUserId = LocalStorageStore.get(LocalStorageKeys.USER_ID)
		if (storedUserId) {
			setUserId(storedUserId)
		} else {
			setUserId('')
		}
	}, [])

	return (
		<ConversationsContextProvider
			value={{
				conversations,
				setConversations,
				currentConversationId,
				setCurrentConversationId,
				currentConversationInfo,
			}}
		>
			<div className={`w-full h-screen flex flex-col overflow-hidden bg-theme-bg`}>
				{/* 头部 */}
				<HeaderLayout
					title={renderCenterTitle?.(currentApp?.config?.info)}
					rightIcon={
						isMobile ? (
							<Dropdown
								menu={{
									className: '!pb-3 w-[80vw]',
									activeKey: currentConversationId,
									items: mobileMenuItems,
								}}
							>
								<MenuOutlined className="text-xl" />
							</Dropdown>
						) : null
					}
				/>

				{/* Main */}
				<div className="flex-1 overflow-hidden flex rounded-t-3xl bg-theme-main-bg">
					{appLoading || initLoading ? (
						<div className="absolute w-full h-full left-0 top-0 z-50 flex items-center justify-center">
							<Spin spinning />
						</div>
					) : currentApp?.config ? (
						<>
							{/* 左侧对话列表 */}
							<div
								className={`hidden md:!flex ${sidebarOpen ? 'w-72' : 'w-14'} transition-all h-full flex-col border-0 border-r border-solid border-r-theme-splitter`}
							>
								{sidebarOpen ? (
									<Tabs
										defaultActiveKey="chat"
										className="h-full flex flex-col"
										tabBarStyle={{ width: '100%' }}
										moreIcon={null}
										items={[
											{
												key: 'apps',
												label: (
													<div className="text-center flex items-center justify-center gap-2 w-full px-2">
														<AppstoreOutlined />
														{t('Apps')}
													</div>
												),
												children: (
													<div className="px-4 mt-3 flex-1 overflow-auto">
														<Spin spinning={appListLoading}>
															{appList.length ? (
																appList.map(app => (
																	<div
																		key={app.id}
																		className={`mb-3 flex items-center gap-2 cursor-pointer ${currentApp?.config.id === app.id ? 'bg-primary/10 border border-primary rounded' : ''}`}
																		onClick={() => handleAppSelect(app)}
																	>
																		<AppIcon app={app} size="small" />
																		<span className={currentApp?.config.id === app.id ? 'text-primary font-semibold' : ''}>
																			{app.info.name}
																		</span>
																	</div>
																))
															) : (
																<Empty description={t("No apps")} />
															)}
														</Spin>
													</div>
												),
											},
											{
												key: 'chat',
												label: (
													<div className="w-1/2 text-center flex items-center justify-center gap-2">
														<MessageOutlined />
														{t('Chat')}
													</div>
												),
												children: (
													<>
														<div className="px-4 mt-3 flex-1 overflow-auto">
															{conversationListWithEmpty}
														</div>
													</>
												),
											},
										]}
									/>
								) : (
									<div className="flex flex-col justify-start items-center flex-1 pt-6">
										{/* 应用图标 */}
										<div className="mb-1.5 flex items-center justify-center">
											<AppIcon app={currentApp} size="small" />
										</div>
										<Popover
											content={
												<div className="max-h-[50vh] overflow-auto pr-3">
													{conversationListWithEmpty}
												</div>
											}
											title={t("Conversations")}
											placement="rightTop"
										>
											{/* 必须包裹一个 HTML 标签才能正常展示 Popover */}
											<div className="flex items-center justify-center">
												<LucideIcon
													className="my-1.5 cursor-pointer hover:text-primary"
													strokeWidth={1.25}
													size={28}
													name="menu"
												/>
											</div>
										</Popover>
									</div>
								)}

								<div className="border-0 border-t border-solid border-theme-splitter flex items-center justify-center h-12">
									<div className="flex items-center justify-between w-full">
										{sidebarOpen && (
											<span className="text-theme-text ml-2">{userId.split('@')[0] || 'Anonymous'}</span>
										)}
										<LucideIcon
											onClick={() => {
												setSidebarOpen(!sidebarOpen)
											}}
											name={sidebarOpen ? 'arrow-left-circle' : 'arrow-right-circle'}
											className="cursor-pointer hover:text-primary"
											strokeWidth={1.25}
											size={28}
										/>
									</div>
								</div>
							</div>

							{/* 右侧聊天窗口 - 移动端全屏 */}
							<div className="flex-1 min-w-0 flex flex-col overflow-hidden">
								<ChatboxWrapper
									difyApi={difyApi}
									conversationListLoading={conversationListLoading}
									onAddConversation={onAddConversation}
									conversationItemsChangeCallback={() => getConversationItems(false)}
								/>
							</div>
						</>
					) : (
						<div className="w-full h-full flex items-center justify-center">
							<Empty
								description={t("No apps")}
								className="text-base"
							/>
						</div>
					)}
				</div>
			</div>

			{extComponents}
		</ConversationsContextProvider>
	)
}
