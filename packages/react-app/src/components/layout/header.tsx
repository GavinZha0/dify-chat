import { DebugMode, LucideIcon } from '@/components'
import { LocalStorageKeys, LocalStorageStore, useIsMobile } from '@dify-chat/helpers'
import { ThemeSelector, useThemeContext } from '@dify-chat/theme'
import { Button, Space } from 'antd'
import classNames from 'classnames'
import React from 'react'

import CenterTitleWrapper from './center-title-wrapper'
import { Logo } from './logo'
import ExternalLinksDropdown from '@/components/externalLinks/links-dropdown.tsx'
import { LanguageToggle } from '@/language/language-toggle.tsx'

export interface IHeaderLayoutProps {
	/**
	 * 自定义标题
	 */
	title?: React.ReactNode
	/**
	 * 传进来的标题是否已经包含容器
	 */
	isTitleWrapped?: boolean
	/**
	 * 自定义右侧图标
	 */
	rightIcon?: React.ReactNode
	/**
	 * Logo 文本
	 */
	logoText?: string
	/**
	 * 自定义 Logo 渲染
	 */
	renderLogo?: () => React.ReactNode
}

const HeaderSiderIcon = (props: { align: 'left' | 'right'; children: React.ReactNode }) => {
	return (
		<div
			className={classNames({
				'flex-1 h-full flex items-center': true,
				'justify-start': props.align === 'left',
				'justify-end': props.align === 'right',
			})}
		>
			{props.children}
		</div>
	)
}

/**
 * 头部布局组件
 */
export default function HeaderLayout(props: IHeaderLayoutProps) {
	const { isTitleWrapped, title, rightIcon, logoText, renderLogo } = props
	const { themeMode } = useThemeContext()
	const isMobile = useIsMobile()

	const handleLogout = () => {
		LocalStorageStore.remove(LocalStorageKeys.LOGIN_DATE)
		window.location.replace('/dify-chat/auth')
	}

	return (
		<div className="h-16 flex items-center justify-between px-4">
			{/* 🌟 Logo */}
			<HeaderSiderIcon align="left">
				<Logo
					text={logoText}
					renderLogo={renderLogo}
					hideText={isMobile}
					hideGithubIcon
				/>
			</HeaderSiderIcon>

			{/* 中间标题 */}
			{isTitleWrapped ? title : <CenterTitleWrapper>{title}</CenterTitleWrapper>}

			{/* 右侧图标 */}
			<HeaderSiderIcon align="right">
				{rightIcon || (
					<Space
						className="flex items-center"
						size={6}
					>
						<DebugMode />
						<ThemeSelector>
							<Button size="small" style={{ border: 'none' }}>
								<LucideIcon
									name={
										themeMode === 'dark'
											? 'moon-star'
											: themeMode === 'light'
												? 'sun'
												: 'monitor-dot'
									}
									size={16}
								/>
							</Button>
						</ThemeSelector>
						<ExternalLinksDropdown />
						<LanguageToggle></LanguageToggle>
						<div className="flex items-center cursor-pointer" onClick={handleLogout}>
							<LucideIcon name="log-out" size={16} />
						</div>
					</Space>
				)}
			</HeaderSiderIcon>
		</div>
	)
}
