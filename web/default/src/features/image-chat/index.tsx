import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PROMPT_TEMPLATES = [
  {
    key: 'product-photo',
    label: 'Product Photo',
    prompt: `生成一张真实感很强的日常家居用品产品摄影图。

产品设定：
- 产品是一只高品质陶瓷香薰加湿器，适合放在卧室床头柜或客厅边几
- 外观为温润米白色陶瓷，圆润但不夸张，表面有细微手工釉面纹理
- 顶部有非常轻的雾气溢出，旁边放一小瓶天然精油和一块浅色亚麻布

拍摄要求：
- 画面必须像真实相机拍摄所得，不要像 3D 渲染图、广告合成图或插画
- 使用自然窗光，柔和阴影，浅景深，背景轻微虚化
- 构图干净真实，有生活气息，但不要过度摆拍
- 保留产品真实比例和材质细节，陶瓷、玻璃、布料和木质桌面的触感要可信
- 不要出现文字、Logo、水印、海报排版或 UI 元素
- 横向画幅，适合后续作为电商网站或品牌官网的主视觉素材`,
  },
  { key: 'portrait', label: 'Portrait', prompt: '请生成一张自然光人像照片，肤色真实，保留皮肤纹理，浅景深，背景干净，不要文字和水印。' },
  { key: 'food', label: 'Food', prompt: '请生成一张高级餐厅风格的食物摄影图，强调食材细节与蒸汽氛围，柔和侧光，写实风格，不要文字和logo。' },
]

export function ImageChatPage() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState(PROMPT_TEMPLATES[0].prompt)
  const [isGenerating, setIsGenerating] = useState(false)
  const [imageBase64, setImageBase64] = useState('')

  const runGenerate = async () => {
    if (!prompt.trim()) {
      toast.error(t('Please enter a prompt.'))
      return
    }
    setIsGenerating(true)
    try {
      const response = await fetch('/api/user/image-chat/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = (await response.json()) as { output?: Array<{ type?: string; result?: string }>; message?: string }
      if (!response.ok) {
        toast.error(data.message || t('Image generation failed.'))
        return
      }
      const imageCall = data.output?.find((item) => item.type === 'image_generation_call' && item.result)
      if (!imageCall?.result) {
        toast.error(t('No image returned from model response.'))
        return
      }
      setImageBase64(imageCall.result)
      toast.success(t('Image generated successfully.'))
    } catch {
      toast.error(t('Image generation failed.'))
    } finally {
      setIsGenerating(false)
    }
  }

  return <div className='mx-auto flex w-full max-w-6xl flex-col gap-4 p-4'><Card><CardHeader><CardTitle>{t('Image Chat (GPT-5.5 + GPT-Image-2)')}</CardTitle></CardHeader><CardContent className='space-y-4'><div className='flex flex-wrap gap-2'>{PROMPT_TEMPLATES.map((template)=><Button key={template.key} variant='outline' onClick={()=>setPrompt(template.prompt)}>{template.label}</Button>)}</div><Textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} rows={12} placeholder={t('Describe the image you want to generate...')} /><div className='flex gap-2'><Button onClick={runGenerate} disabled={isGenerating}>{isGenerating ? t('Generating...') : t('Generate Image')}</Button></div></CardContent></Card>{imageBase64 ? <Card><CardHeader><CardTitle>{t('Generated Result')}</CardTitle></CardHeader><CardContent><img src={`data:image/png;base64,${imageBase64}`} alt={t('Generated image')} className='w-full rounded-md border' /></CardContent></Card> : null}</div>
}
