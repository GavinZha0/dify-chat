import React, { useEffect, useState } from 'react';
import { Button, Dropdown, Menu } from 'antd'
import { LocalStorageKeys, LocalStorageStore } from '@dify-chat/helpers';
import { ExternalLink } from 'lucide-react'
import { LucideIcon } from '@/components'

interface LinkConfig {
	name: string;
	url: string;
}

const ExternalLinksDropdown: React.FC = () => {
	const [links, setLinks] = useState<LinkConfig[]>([]);

	useEffect(() => {
		const userGroup = LocalStorageStore.get(LocalStorageKeys.USER_GROUP);
		const internalGroup = ['ADM'];
		if (internalGroup.includes(userGroup)) {
			// only internal groups can see the links
			fetch('/dify-chat/link_config.json')
				.then((res) => res.json())
				.then(setLinks);
		}
	}, []);

	const linkMenus = (
		<Menu>
			{links.map((link) => (
				<Menu.Item key={link.name}>
					<a href={link.url} target="_blank" rel="noopener noreferrer">
						{link.name}
					</a>
				</Menu.Item>
			))}
		</Menu>
	);

	return (
		<Dropdown overlay={linkMenus} trigger={['click']}>
			<Button
				size='small'
				title="External Links"
				style={{ border: 'none'}}
			>
				<LucideIcon name="link" size={16} />
			</Button>
		</Dropdown>
	);
};

export default ExternalLinksDropdown;
