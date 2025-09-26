import { copyToClipboard } from '@toolkit-fe/clipboard'
import { message } from 'antd'

import LucideIcon from '../../lucide-icon'
import { useLanguage } from '@/language/language-context.tsx'

interface IWorkflowNodeDetailProps {
	/**
	 * 原始结构化内容
	 */
	originalContent: string
}

export default function WorkflowNodeDetail(props: IWorkflowNodeDetailProps) {
	const { originalContent } = props
	const { t } = useLanguage()

	return (
		<div>
			{originalContent ? (
				<>
					<LucideIcon
						name="copy"
						size={16}
						className="cursor-pointer text-theme-text"
						onClick={async () => {
							await copyToClipboard(JSON.stringify(originalContent, null, 2))
							message.success(t('Copied'))
						}}
					/>
					<pre className="w-full overflow-auto m-0">{JSON.stringify(originalContent, null, 2)}</pre>
				</>
			) : (
				<pre>空</pre>
			)}
		</div>
	)
}
