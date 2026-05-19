import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PROMPT_TEMPLATES = [
  {
    key: 'product-photo',
    label: '产品摄影',
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
  {
    key: 'portrait',
    label: '人物写真',
    prompt:
      '请生成一张自然光人像照片，肤色真实，保留皮肤纹理，浅景深，背景干净，不要文字和水印。',
  },
  {
    key: 'food',
    label: '美食摄影',
    prompt:
      '请生成一张高级餐厅风格的食物摄影图，强调食材细节与蒸汽氛围，柔和侧光，写实风格，不要文字和 logo。',
  },
]

type ImageGenerationOutputItem = {
  type?: string
  result?: string
}

type ImageChatRelayResponse = {
  success?: boolean
  message?: string
  output?: ImageGenerationOutputItem[]
  data?: {
    output?: ImageGenerationOutputItem[]
  }
}

export function ImageChatPage() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState(PROMPT_TEMPLATES[0].prompt)
  const [isGenerating, setIsGenerating] = useState(false)
  const [imageBase64, setImageBase64] = useState('')

  const runGenerate = async () => {
    if (!prompt.trim()) {
      toast.error(t('请输入图像描述。'))
      return
    }

    setIsGenerating(true)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 180000)

    try {
      const response = await fetch('/api/user/image-chat/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      })

      const data = (await response.json()) as ImageChatRelayResponse
      if (!response.ok) {
        toast.error(data.message || t('图像生成失败。'))
        return
      }

      if (data.success === false) {
        toast.error(data.message || t('图像生成失败。'))
        return
      }

      const output = data.data?.output || data.output || []
      const imageCall = output.find((item) => item.type === 'image_generation_call' && item.result)
      if (!imageCall?.result) {
        toast.error(data.message || t('模型没有返回图像结果。'))
        return
      }

      setImageBase64(imageCall.result)
      toast.success(t('图像生成成功。'))
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error(t('生成超时，请稍后重试。'))
      } else {
        toast.error(t('图像生成失败。'))
      }
    } finally {
      window.clearTimeout(timeoutId)
      setIsGenerating(false)
    }
  }

  return (
    <div className='mx-auto w-full max-w-6xl p-4'>
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle>{t('文生图（GPT-5.5 + GPT-Image-2）')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap gap-2'>
            {PROMPT_TEMPLATES.map((template) => (
              <Button key={template.key} variant='outline' onClick={() => setPrompt(template.prompt)}>
                {template.label}
              </Button>
            ))}
          </div>

          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={10}
            className='min-h-[220px] resize-y leading-7'
            placeholder={t('请输入你想生成的图像描述，例如：场景、风格、光线、构图。')}
          />

          <div className='flex flex-wrap items-center gap-3'>
            <Button onClick={runGenerate} disabled={isGenerating} className='min-w-28'>
              {isGenerating ? t('生成中...') : t('生成图片')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {imageBase64 ? (
        <Card className='mt-4'>
          <CardHeader>
            <CardTitle>{t('生成结果')}</CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt={t('生成图片结果')}
              className='w-full rounded-md border object-contain'
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
