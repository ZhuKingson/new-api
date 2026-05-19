/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../helpers';
import { Button, Card, TextArea } from '@douyinfe/semi-ui';

const PROMPT_TEMPLATES = [
  {
    key: 'product-photo',
    label: '产品摄影',
    prompt:
      '生成一张真实感很强的日常家居用品产品摄影图，浅景深，自然窗光，保留材质细节，不要文字水印。',
  },
  {
    key: 'portrait',
    label: '人物写真',
    prompt:
      '请生成一张自然光人像照片，肤色真实，保留皮肤纹理，背景干净，不要文字和水印。',
  },
  {
    key: 'food',
    label: '美食摄影',
    prompt:
      '请生成一张高级餐厅风格的食物摄影图，强调食材细节与蒸汽氛围，柔和侧光，写实风格。',
  },
];

export default function ImageChat() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(PROMPT_TEMPLATES[0].prompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageBase64, setImageBase64] = useState('');

  const runGenerate = async () => {
    if (!prompt.trim()) {
      showError(t('请输入图像描述。'));
      return;
    }

    setIsGenerating(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 180000);

    try {
      const res = await API.post('/api/user/image-chat/generate', { prompt }, { signal: controller.signal });
      const { success, message, data, output } = res.data || {};

      if (success === false) {
        showError(message || t('图像生成失败。'));
        return;
      }

      const normalizedOutput = data?.output || output || [];
      const imageCall = normalizedOutput.find(
        (item) => item?.type === 'image_generation_call' && item?.result,
      );
      if (!imageCall?.result) {
        showError(message || t('模型没有返回图像结果。'));
        return;
      }

      setImageBase64(imageCall.result);
      showSuccess(t('图像生成成功。'));
    } catch (error) {
      if (error?.name === 'CanceledError' || error?.name === 'AbortError') {
        showError(t('生成超时，请稍后重试。'));
      } else {
        showError(t('图像生成失败。'));
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '64px auto 0',
        padding: '0 16px 16px',
      }}
    >
      <Card title={t('文生图（GPT-5.5 + GPT-Image-2）')}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {PROMPT_TEMPLATES.map((template) => (
            <Button key={template.key} theme='borderless' onClick={() => setPrompt(template.prompt)}>
              {template.label}
            </Button>
          ))}
        </div>
        <TextArea
          value={prompt}
          onChange={setPrompt}
          rows={10}
          placeholder={t('请输入你想生成的图像描述，例如：场景、风格、光线、构图。')}
        />
        <div style={{ marginTop: 12 }}>
          <Button loading={isGenerating} onClick={runGenerate}>
            {isGenerating ? t('生成中...') : t('生成图片')}
          </Button>
        </div>
      </Card>

      {imageBase64 ? (
        <Card title={t('生成结果')} style={{ marginTop: 16 }}>
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={t('生成图片结果')}
            style={{ width: '100%', borderRadius: 8 }}
          />
        </Card>
      ) : null}
    </div>
  );
}
