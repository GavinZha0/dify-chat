'use client'

import { useLanguage } from './language-context'
import { Button } from 'antd'

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  return (
    <Button
			size="small"
			style={{ border: 'none' }}
      onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
    >
      {language === 'zh' ? '中' : 'EN'}
    </Button>
  )
}

