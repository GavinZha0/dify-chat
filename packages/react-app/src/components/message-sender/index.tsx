import { CloudUploadOutlined, LinkOutlined } from '@ant-design/icons'
import { Attachments, AttachmentsProps, Sender } from '@ant-design/x'
import { DifyApi, IFile, IUploadFileResponse } from '@dify-chat/api'
import { useAppContext, useConversationsContext } from '@dify-chat/core'
import { useThemeContext } from '@dify-chat/theme'
import { Badge, Button, GetProp, GetRef, message } from 'antd'
import { RcFile } from 'antd/es/upload'
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { FileTypeMap, getDifyFileType, getFileExtByName } from './utils'
import { useLanguage } from '@/language/language-context.tsx'

interface IMessageSenderProps {
	/**
	 * 类名
	 */
	className?: string
	/**
	 * 是否正在请求
	 */
	isRequesting: boolean
	/**
	 * 上传文件 Api
	 */
	uploadFileApi: (file: File) => Promise<IUploadFileResponse>
	/**
	 * 语音转文字 Api
	 */
	audio2TextApi?: DifyApi['audio2Text']
	/**
	 * 提交事件
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
	 * 取消事件
	 */
	onCancel: () => void
}

/**
 * 用户消息发送区
 */
export const MessageSender = (props: IMessageSenderProps) => {
	const { isRequesting, onSubmit, className, onCancel, uploadFileApi, audio2TextApi } = props
	const { currentApp } = useAppContext()
	const [content, setContent] = useState('')
	const [open, setOpen] = useState(false)
	const [files, setFiles] = useState<GetProp<AttachmentsProps, 'items'>>([])
	const [fileIdMap, setFileIdMap] = useState<Map<string, string>>(new Map())
	const recordedChunks = useRef<Blob[]>([])
	const [audio2TextLoading, setAudio2TextLoading] = useState(false)
	const attachmentsRef = useRef<GetRef<typeof Attachments>>(null)
	const senderRef = useRef<GetRef<typeof Sender>>(null)
	const { isLight } = useThemeContext()
	const { currentConversationId } = useConversationsContext()
	const { t } = useLanguage()

	// 监听对话切换时，自动聚焦输入框
	useEffect(() => {
		senderRef.current?.focus()
	}, [currentConversationId])

	const onChange = (value: string) => {
		setContent(value)
	}

	const allowedFileTypes = useMemo(() => {
		if (currentApp?.parameters?.file_upload?.allowed_file_extensions) {
			return currentApp?.parameters?.file_upload?.allowed_file_extensions
		} else {
			return []
		}
	}, [currentApp?.parameters?.file_upload])

	const handleUpload = async (file: RcFile) => {
		const prevFiles = [...files]

		const fileBaseInfo: GetProp<AttachmentsProps, 'items'>[number] = {
			uid: file.uid,
			name: file.name,
			status: 'uploading',
			size: file.size,
			type: file.type,
			originFileObj: file,
		}

		// 模拟上传进度
		const mockLoadingProgress = () => {
			let percent = 0
			setFiles([
				...prevFiles,
				{
					...fileBaseInfo,
					percent: percent,
				},
			])
			const interval = setInterval(() => {
				if (percent >= 99) {
					clearInterval(interval)
					return
				}
				percent = percent + 1
				setFiles([
					...prevFiles,
					{
						...fileBaseInfo,
						percent,
					},
				])
			}, 100)
			return {
				clear: () => clearInterval(interval),
			}
		}
		const { clear } = mockLoadingProgress()

		const result = await uploadFileApi(file)
		clear()
		setFiles([
			...prevFiles,
			{
				...fileBaseInfo,
				percent: 100,
				status: 'done',
			},
		])
		setFileIdMap(prevMap => {
			const nextMap = new Map(prevMap)
			nextMap.set(file.uid, result.id)
			return nextMap
		})
	}

	const senderHeader = (
		<Sender.Header
			title={t("Upload file")}
			open={open}
			onOpenChange={setOpen}
			styles={{
				content: {
					padding: 0,
				},
			}}
		>
			<Attachments
				ref={attachmentsRef}
				beforeUpload={async file => {
					// 校验文件类型
					// 自定义上传
					const ext = getFileExtByName(file.name)
					// 校验文件类型
					if (ext && allowedFileTypes.length > 0 && !allowedFileTypes.includes("." + ext.toUpperCase())) {
						message.error(`Unsupported type: ${ext}`)
						return false
					}

					handleUpload(file)
					return false
				}}
				items={files}
				placeholder={type =>
					type === 'drop'
						? {
								title: t('Drop file here'),
							}
						: {
								icon: <CloudUploadOutlined />,
								title: t('Click or drag file into this area'),
								description: (
									<div>
										{allowedFileTypes.join(', ')}
									</div>
								),
							}
				}
				getDropContainer={() => senderRef.current?.nativeElement}
				onRemove={file => {
					setFiles(prev => {
						return prev.filter(item => {
							return item.uid !== file.uid
						})
					})
				}}
			/>
		</Sender.Header>
	)

	const [recording, setRecording] = useState(false)
	const mediaRecorder = useRef<MediaRecorder | null>(null)

	/**
	 * 语音转文本配置
	 */
	const allowSpeechConfig = useMemo(() => {
		if (!currentApp?.parameters?.speech_to_text?.enabled) {
			return true
		}
		return {
			recording,
			onRecordingChange: async nextRecording => {
				if (nextRecording) {
					try {
						const stream = await navigator.mediaDevices.getUserMedia({
							audio: true,
						})
						mediaRecorder.current = new MediaRecorder(stream)

						mediaRecorder.current.ondataavailable = event => {
							if (event.data.size > 0) {
								recordedChunks.current = [...recordedChunks.current, event.data]
							}
						}

						mediaRecorder.current.onstop = () => {
							const blob = new Blob(recordedChunks.current, {
								type: 'audio/webm',
							})
							setAudio2TextLoading(true)
							setContent('Recognizing...')
							audio2TextApi?.(blob as File)
								.then(res => {
									setContent(res.text)
									recordedChunks.current = []
								})
								.catch(error => {
									console.error('Error in speech-to-text', error)
									message.error(`Error in speech-to-text: ${error}`)
									setContent('')
								})
								.finally(() => {
									setAudio2TextLoading(false)
								})
						}

						mediaRecorder.current.start()
					} catch (error) {
						console.error('Error accessing microphone:', error)
					}
				} else {
					mediaRecorder.current?.stop()
				}

				setRecording(nextRecording)
			},
		} as GetProp<typeof Sender, 'allowSpeech'>
	}, [currentApp, recording, audio2TextApi])

	// 是否允许文件上传
	const enableFileUpload = currentApp?.parameters?.file_upload?.enabled

	return (
		<Sender
			ref={senderRef}
			allowSpeech={allowSpeechConfig}
			header={senderHeader}
			value={content}
			onChange={onChange}
			prefix={
				enableFileUpload ? (
					// 附件上传按钮
					<Badge dot={files.length > 0 && !open}>
						<Button
							onClick={() => setOpen(!open)}
							icon={<LinkOutlined className="text-theme-text" />}
						/>
					</Badge>
				) : null
			}
			style={{
				boxShadow: isLight ? '0px -2px 12px 4px var(--theme-border-color)' : 'none',
			}}
			loading={isRequesting}
			disabled={audio2TextLoading}
			className={className}
			onPasteFile={
				enableFileUpload
					? (firstFile, files) => {
							if (files?.length > 1) {
								message.warning('Please upload one file at a time')
								return
							}
							// 如果附件面板是关闭状态，则打开
							if (!open) {
								// 强制更新 立即打开 Attachments 面板，以供获取 attachmentsRef
								flushSync(() => setOpen(true))
							}
							attachmentsRef.current?.upload(firstFile)
						}
					: undefined
			}
			onSubmit={async content => {
				if (!content) {
					message.error('Empty')
					return
				}
				// 当文件存在时，判断是否所有文件都已上传完成
				if (files?.length && !files.every(item => item.status === 'done')) {
					message.error('Upload not complete, please wait')
					return
				}
				await onSubmit(content, {
					files:
						files?.map(file => {
							const fileType = getDifyFileType(
								file.name,
								currentApp?.parameters?.file_upload?.allowed_file_types || [],
							)
							return {
								...file,
								type: fileType || 'custom',
								transfer_method: 'local_file',
								upload_file_id: fileIdMap.get(file.uid) as string,
							}
						}) || [],
				})
				setContent('')
				setFiles([])
				setOpen(false)
			}}
			onCancel={onCancel}
		/>
	)
}
