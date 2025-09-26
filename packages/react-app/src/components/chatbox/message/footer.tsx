import { DifyApi, IGetAppParametersResponse, IRating } from '@dify-chat/api'
import { copyToClipboard } from '@toolkit-fe/clipboard'
import { useRequest, useSetState } from 'ahooks'
import { message as antdMessage, Space } from 'antd'
import { Modal, Input } from 'antd'
import { useState } from 'react'

import LucideIcon from '../../lucide-icon'
import ActionButton from './action-btn'
import { useLanguage } from '@/language/language-context.tsx'

interface IMessageFooterProps {
	/**
	 * 是否正在对话中
	 */
	isRequesting?: boolean
	/**
	 * 反馈 API
	 */
	feedbackApi: (params: {
		/**
		 * 反馈的消息 ID
		 */
		messageId: string
		/**
		 * 反馈操作类型
		 */
		rating: IRating
		/**
		 * 反馈文本内容
		 */
		content: string
	}) => Promise<unknown>
	/**
	 * 文本转语音 API
	 */
	ttsApi: DifyApi['text2Audio']
	/**
	 * 消息 ID
	 */
	messageId: string
	/**
	 * 消息中的文字内容部分
	 */
	messageContent: string
	/**
	 * 用户对消息的反馈
	 */
	feedback: {
		/**
		 * 用户对消息的点赞/点踩/撤销操作
		 */
		rating?: IRating
		/**
		 * 操作回调
		 */
		callback: () => void
	}
	/**
	 * TTS 配置
	 */
	ttsConfig?: IGetAppParametersResponse['text_to_speech']
	/**
	 * 触发重新生成消息
	 */
	onRegenerateMessage?: () => void
}

/**
 * 消息底部操作区
 */
export default function MessageFooter(props: IMessageFooterProps) {
	const {
		isRequesting,
		messageId,
		messageContent,
		feedback: { rating, callback },
		feedbackApi,
		ttsApi,
		ttsConfig,
		onRegenerateMessage,
	} = props

	const isLiked = rating === 'like'
	const isDisLiked = rating === 'dislike'
	const [loading, setLoading] = useSetState({
		like: false,
		dislike: false,
	})
	const [ttsPlaying, setTTSPlaying] = useState(false)
	const [cachedAudioUrl, setCachedAudioUrl] = useState<string>('')
	const { t } = useLanguage()

	/**
	 * 用户对消息的反馈
	 */
	const { runAsync } = useRequest(
		(rating: IRating, content: string) => {
			return feedbackApi({
				messageId: (messageId as string).replace('-answer', ''),
				rating: rating,
				content: content,
			})
		},
		{
			manual: true,
			onSuccess() {
				antdMessage.success(t('Succeed'))
				callback?.()
			},
			onFinally() {
				setLoading({
					like: false,
					dislike: false,
				})
			},
		},
	)

	/**
	 * 播放音频
	 * @param audioUrl 音频 URL
	 */
	const playAudio = async (audioUrl: string) => {
		const audio = new Audio()
		audio.src = audioUrl
		audio.play()
		setTTSPlaying(true)
		audio.addEventListener('ended', () => {
			// 播放完成后释放 URL 对象
			// URL.revokeObjectURL(audioUrl);
			setTTSPlaying(false)
		})
	}

	/**
	 * 文本转语音
	 */
	const { runAsync: runTTS, loading: ttsLoading } = useRequest(
		(text: string) => {
			return ttsApi({
				text,
			})
				.then(response => response.blob())
				.then(blob => {
					const audioUrl = URL.createObjectURL(blob)
					setCachedAudioUrl(audioUrl)
					playAudio(audioUrl)
				})
		},
		{
			manual: true,
		},
	)

	const [showDislikeModal, setShowDislikeModal] = useState(false)
	const [dislikeFeedback, setDislikeFeedback] = useState('')

	// click 👎
	const handleDislikeClick = () => {
		if(isDisLiked){
			// revert if it had been marked as 👎
			runAsync(null, '')
		} else {
			setShowDislikeModal(true)
		}

	}

// confirm 👎
	const handleDislikeConfirm = async () => {
		setLoading({ dislike: true })
		await runAsync('dislike', dislikeFeedback)
		setShowDislikeModal(false)
		setDislikeFeedback('')
	}

// cancel 👎
	const handleDislikeCancel = () => {
		setShowDislikeModal(false)
		setDislikeFeedback('')
	}

	/**
	 * 操作按钮列表
	 */
	const actionButtons = [
		// 重新生成回复
		{
			icon: <LucideIcon name="refresh-ccw" />,
			hidden: false,
			onClick: () => {
				onRegenerateMessage?.()
			},
		},
		// 复制内容
		{
			icon: <LucideIcon name="copy" />,
			onClick: async () => {
				await copyToClipboard(messageContent)
				antdMessage.success(t('Copied'))
			},
			active: false,
			loading: false,
			hidden: false,
		},
		// 点赞
		{
			icon: <LucideIcon name="thumbs-up" />,
			onClick: () => {
				setLoading({
					like: true,
				})
				runAsync(isLiked ? null : 'like', '')
			},
			active: isLiked,
			loading: loading.like,
			hidden: false,
		},
		// 点踩
		{
			icon: <LucideIcon name="thumbs-down" />,
			onClick: handleDislikeClick,
			active: isDisLiked,
			loading: loading.dislike,
			hidden: false,
		},
		// 文本转语音
		{
			icon: (
				<LucideIcon
					color={
						isRequesting
							? undefined
							: ttsPlaying
								? 'var(--theme-primary-color)'
								: 'var(--theme-text-color)'
					}
					name={ttsPlaying ? 'volume-2' : 'volume-1'}
					size={18}
					strokeWidth={1.75}
				/>
			),
			onClick: () => {
				if (ttsPlaying) return
				if (cachedAudioUrl) {
					playAudio(cachedAudioUrl)
				} else {
					runTTS(messageContent)
				}
			},
			active: ttsPlaying,
			loading: ttsLoading,
			hidden: !ttsConfig?.enabled,
		},
	]

	return (
	<>
		<Space>
			{actionButtons.map(
				(buttonProps, index) =>
					!buttonProps.hidden && (
						<ActionButton
							key={index}
							icon={buttonProps.icon}
							onClick={buttonProps.onClick}
							active={buttonProps.active}
							loading={buttonProps.loading}
							disabled={isRequesting}
						/>
					),
			)}
		</Space>
		<Modal
			title={t("Please provide feedback")}
			open={showDislikeModal}
			onOk={handleDislikeConfirm}
			onCancel={handleDislikeCancel}
			okText="Confirm"
			cancelText="Cancel"
		>
			<Input.TextArea
				value={dislikeFeedback}
				onChange={e => setDislikeFeedback(e.target.value)}
				placeholder={t("Enter feedback")}
				rows={4}
			/>
		</Modal>
	</>
	)
}
