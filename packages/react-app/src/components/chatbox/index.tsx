import { RedoOutlined } from '@ant-design/icons'
import { ArrowRightOutlined } from '@ant-design/icons'
import { Bubble } from '@ant-design/x'
import { DifyApi, IFile, IMessageItem4Render } from '@dify-chat/api'
import { OpeningStatementDisplayMode, Roles, useAppContext } from '@dify-chat/core'
import { isTempId, useIsMobile } from '@dify-chat/helpers'
import { FormInstance, GetProp, message, Spin, Button } from 'antd'
import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import { PlusOutlined } from '@ant-design/icons'
import { validateAndGenErrMsgs } from '@/utils'

import { MessageSender } from '../message-sender'
import MessageContent from './message/content'
import MessageFooter from './message/footer'
import { WelcomePlaceholder } from './welcome-placeholder'
import { useLanguage } from '@/language/language-context.tsx'

export interface ChatboxProps {
	/**
	 * 消息列表
	 */
	messageItems: IMessageItem4Render[]
	/**
	 * 是否正在请求
	 */
	isRequesting: boolean

	/**
	 * 是否有更多历史消息
	 */
	hasMore: boolean

	/**
	 * 加载更多历史消息
	 */
	onLoadMore: () => void

	/**
	 * 下一步问题建议
	 */
	nextSuggestions: string[]
	/**
	 * 推荐 Item 点击事件
	 */
	onPromptsItemClick: (content: string) => void
	/**
	 * 内容提交事件
	 * @param value 问题-文本
	 * @param files 问题-文件
	 */
	onSubmit: (
		value: string,
		options?: {
			files?: IFile[]
			inputs?: Record<string, unknown>
		},
	) => void
	/**
	 * 取消读取流
	 */
	onCancel: () => void
	/**
	 * 对话 ID
	 */
	conversationId: string
	/**
	 * 反馈执行成功后的回调
	 */
	feedbackCallback?: (conversationId: string) => void
	/**
	 * Dify API 实例
	 */
	difyApi: DifyApi
	/**
	 * 反馈 API
	 */
	feedbackApi: DifyApi['createMessageFeedback']
	/**
	 * 上传文件 API
	 */
	uploadFileApi: DifyApi['uploadFile']
	/**
	 * 表单是否填写
	 */
	isFormFilled: boolean
	/**
	 * 表单填写状态改变回调
	 */
	onStartConversation: (formValues: Record<string, unknown>) => void
	/**
	 * 应用入参表单实例
	 */
	entryForm: FormInstance<Record<string, unknown>>

	onAddConversation: () => void
}

/**
 * 对话内容区
 */
export const Chatbox = (props: ChatboxProps) => {
	const {
		messageItems,
		isRequesting,
		nextSuggestions,
		onPromptsItemClick,
		onSubmit,
		onCancel,
		conversationId,
		feedbackCallback,
		difyApi,
		isFormFilled,
		onStartConversation,
		entryForm,
		hasMore,
		onLoadMore,
	} = props
	const isMobile = useIsMobile()
	const { currentApp } = useAppContext()
	const { t } = useLanguage()

	const roles: GetProp<typeof Bubble.List, 'roles'> = {
		ai: {
			placement: 'start',
		},
		user: {
			placement: 'end',
			style: isMobile
				? undefined
				: {
						// 减去一个头像的宽度
						maxWidth: '80%',
						marginLeft: '20%',
					},
		},
	}

	const items: GetProp<typeof Bubble.List, 'items'> = useMemo(() => {
		return messageItems?.map(messageItem => {
			return {
				key: `${messageItem.id}-${messageItem.role}`,
				// 不要开启 loading 和 typing, 否则流式会无效
				// loading: status === 'loading',
				content: messageItem.content,
				messageRender: () => {
					return (
						<MessageContent
							onSubmit={onSubmit}
							messageItem={messageItem}
						/>
					)
				},
				// 用户发送消息时，status 为 local，需要展示为用户头像
				role: messageItem.role === Roles.LOCAL ? Roles.USER : messageItem.role,
				footer: messageItem.role === Roles.AI && (
					<div className="flex items-center">
						<MessageFooter
							ttsConfig={currentApp?.parameters?.text_to_speech}
							feedbackApi={params => difyApi.createMessageFeedback(params)}
							ttsApi={params => difyApi.text2Audio(params)}
							messageId={messageItem.id}
							messageContent={messageItem.content}
							feedback={{
								rating: messageItem.feedback?.rating,
								callback: () => {
									feedbackCallback?.(conversationId!)
								},
							}}
							isRequesting={isRequesting}
							onRegenerateMessage={() => {
								// 直接通过遍历找到当前消息的用户子消息，取其内容发送消息
								const currentItem = messageItems.find(item => item.id === messageItem.id)
								if (!currentItem) {
									console.error('No message:', messageItem.id)
									message.error(t('No message'))
									return
								}
								const messageParams: {
									inputs: Record<string, unknown>
									files?: IFile[]
								} = {
									inputs: entryForm.getFieldsValue(),
								}
								if (currentItem.files && currentItem.files.length > 0) {
									messageParams.files = currentItem.files.map(file => ({
										type: file.type,
										transfer_method: file.transfer_method,
										url: file.url,
										upload_file_id: file.upload_file_id || '',
									})) as IFile[]
								}
								onSubmit(currentItem.content, messageParams)
							}}
						/>
						{messageItem.created_at && (
							<div className="ml-3 text-sm text-desc">{t('Time')}: {messageItem.created_at}</div>
						)}
					</div>
				),
			}
		}) as GetProp<typeof Bubble.List, 'items'>
	}, [
		messageItems,
		conversationId,
		difyApi,
		feedbackCallback,
		currentApp?.parameters,
		onSubmit,
		isRequesting,
		entryForm,
	])

	// 监听 items 更新，滚动到最底部
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	// 延迟更新，优化性能
	const deferredItems = useDeferredValue(items)
	useEffect(() => {
		// 如果非请求中，不滚动（防止影响下拉刷新工能）
		if (!isRequesting) {
			return
		}
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollTo({
				behavior: 'smooth',
				top: scrollContainerRef.current.scrollHeight,
			})
		}
	}, [deferredItems])

	// 获取应用的对话开场白展示模式
	const openingStatementMode =
		currentApp?.config?.extConfig?.conversation?.openingStatement?.displayMode

	// 是否展示开场白
	const promptsVisible = useMemo(() => {
		if (openingStatementMode === OpeningStatementDisplayMode.Always) {
			return true
		}
		return !items?.length && isTempId(conversationId)
	}, [openingStatementMode, items, conversationId])

	return (
		<div className="w-full h-full overflow-hidden my-0 mx-auto box-border flex flex-col gap-4 relative">
			<div className="w-full h-full overflow-hidden pt-1 pb-24">
				<div
					id="scrollableDiv"
					ref={scrollContainerRef}
					style={{
						height: '100%',
						overflow: 'auto',
						display: 'flex',
						flexDirection: 'column-reverse',
					}}
				>
					<InfiniteScroll
						scrollableTarget="scrollableDiv"
						hasMore={hasMore}
						next={onLoadMore}
						dataLength={messageItems.length}
						loader={
							<div style={{ textAlign: 'center' }}>
								<Spin
									indicator={<RedoOutlined spin />}
									size="small"
								/>
							</div>
						}
						inverse
						style={{
							display: 'flex',
							flexDirection: 'column-reverse',
							// 减去除消息列表外其他纵向元素的高度
							minHeight: 'calc(100vh - 10.25rem)',
						}}
					>
						<div className="flex-1 w-full md:!w-[960px] mx-auto px-3 pb-6 md:px-0 box-border">
							{/* 🌟 消息列表 */}
							<Bubble.List
								items={items}
								roles={roles}
							/>

							{/* 下一步问题建议 当存在消息列表，且非正在对话时才展示 */}
							{nextSuggestions?.length && items.length && !isRequesting ? (
								<div className="py-3 mt-3">
									<div className="text-desc">🤔 {t('You might ask')}:</div>
									<div>
										{nextSuggestions?.map(item => {
											return (
												<div
													key={item}
													className="mt-3 flex items-center"
												>
													<div
														className="p-2 shrink-0 cursor-pointer rounded-lg flex items-center border border-solid border-theme-border text-sm max-w-full text-theme-desc"
														onClick={() => {
															onPromptsItemClick(item)
														}}
													>
														<span className="truncate">{item}</span>
														<ArrowRightOutlined className="ml-1" />
													</div>
												</div>
											)
										})}
									</div>
								</div>
							) : null}
						</div>
						{/* 🌟 欢迎占位 + 对话参数 */}
						<WelcomePlaceholder
							showPrompts={promptsVisible}
							onPromptItemClick={onPromptsItemClick}
							formFilled={isFormFilled}
							onStartConversation={onStartConversation}
							conversationId={conversationId}
							entryForm={entryForm}
							uploadFileApi={(...params) => difyApi.uploadFile(...params)}
						/>
					</InfiniteScroll>
				</div>
				<div
					className="absolute bottom-0 bg-theme-main-bg w-full md:max-w-[960px] left-1/2"
					style={{
						transform: 'translateX(-50%)',
					}}
				>
					<div className="flex items-center">
						<Button
							icon={<PlusOutlined />}
							type="primary"
							className="mr-2"
							onClick={props.onAddConversation}
						>
						</Button>
						{/* 🌟 输入框 */}
						<div style={{ flex: 1 }}>
							<MessageSender
								onSubmit={async (...params) => {
									return validateAndGenErrMsgs(entryForm).then(res => {
										if (res.isSuccess) {
											return onSubmit(...params)
										} else {
											message.error(res.errMsgs)
											return Promise.reject(`Fail to validate form: ${res.errMsgs}`)
										}
									})
								}}
								isRequesting={isRequesting}
								className="w-full !text-theme-text"
								uploadFileApi={(...params) => {
									return difyApi.uploadFile(...params)
								}}
								audio2TextApi={(...params) => difyApi.audio2Text(...params)}
								onCancel={onCancel}
							/>
						</div>
					</div>
					<div className="text-theme-desc text-sm text-center h-8 leading-8 truncate">
						{currentApp?.site?.custom_disclaimer || t('Generated by AI and is for reference only')}
					</div>
				</div>
			</div>
		</div>
	)
}
