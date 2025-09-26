import { useAppContext } from '@dify-chat/core'
import { useThemeContext } from '@dify-chat/theme'
// @ts-expect-error no declaration file
import emoji from 'emoji-dictionary'
import { useMemo } from 'react'

import { completeFileUrl } from '@/utils'

/**
 * 应用图标
 */
export default function AppIcon(props: { app: any; size?: 'small' | 'default'; hasContainer?: boolean }) {
	const { size = 'default', hasContainer = false, app } = props

	const { currentApp } = useAppContext()
	const { isDark } = useThemeContext()

	const renderProps = useMemo(() => {
		// default icon
		let theIcon = '🤖'

		if(currentApp?.config?.id === app?.id){
			if(currentApp?.site?.icon_url){
				// image
				theIcon = completeFileUrl(currentApp?.site?.icon_url, currentApp?.config.requestConfig.apiBase)
			}
			else {
				// emoji
				theIcon = currentApp?.site?.icon || '🤖'
			}

			return {
				background: currentApp?.site?.icon_background || '#ffead5',
				type: currentApp?.site?.icon_type || 'emoji',
				icon: theIcon
			}
		}
		else{
			return {
				background: '#ffead5',
				type: 'emoji',
				icon: theIcon
			}
		}
	}, [currentApp])

	const renderIcon = useMemo(() => {
		return renderProps.type === 'emoji' ? (
			renderProps.icon === '🤖' ? (
				'🤖'
			) : (
				emoji.getUnicode(renderProps.icon)
			)
		) : (
			<img
				className="w-full h-full inline-block"
				src={renderProps.icon}
			/>
		)
	}, [renderProps])

	if (hasContainer) {
		return renderIcon
	}

	return (
		<div
			className={`rounded-lg flex items-center justify-center ${size === 'small' ? 'w-9 h-9 text-xl' : 'w-11 h-11 text-2xl'} flex items-center overflow-hidden`}
			style={{
				background: isDark ? 'transparent' : renderProps.background,
			}}
		>
			{renderIcon}
		</div>
	)
}
