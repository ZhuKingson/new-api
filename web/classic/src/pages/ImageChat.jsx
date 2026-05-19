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
    label: 'Product Photo',
    prompt:
      '生成一张真实感很强的日常家居用品产品摄影图，浅景深，自然窗光，保留材质细节，不要文字水印。',
  },
  {
    key: 'portrait',
    label: 'Portrait',
    prompt:
      '请生成一张自然光人像照片，肤色真实，保留皮肤纹理，背景干净，不要文字和水印。',
  },
  {
    key: 'food',
    label: 'Food',
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
      showError(t('Please enter a prompt.'));
      return;
    }

    setIsGenerating(true);
    try {
      const res = await API.post('/api/user/image-chat/generate', { prompt });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('Image generation failed.'));
        return;
      }

      const imageCall = data?.output?.find(
        (item) => item?.type === 'image_generation_call' && item?.result,
      );
      if (!imageCall?.result) {
        showError(t('No image returned from model response.'));
        return;
      }

      setImageBase64(imageCall.result);
      showSuccess(t('Image generated successfully.'));
    } catch {
      showError(t('Image generation failed.'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
      <Card title={t('Image Chat (GPT-5.5 + GPT-Image-2)')}>
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
          placeholder={t('Describe the image you want to generate...')}
        />
        <div style={{ marginTop: 12 }}>
          <Button loading={isGenerating} onClick={runGenerate}>
            {isGenerating ? t('Generating...') : t('Generate Image')}
          </Button>
        </div>
      </Card>

      {imageBase64 ? (
        <Card title={t('Generated Result')} style={{ marginTop: 16 }}>
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={t('Generated image')}
            style={{ width: '100%', borderRadius: 8 }}
          />
        </Card>
      ) : null}
    </div>
  );
}
