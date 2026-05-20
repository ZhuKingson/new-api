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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../helpers';
import { Button, Card, TextArea } from '@douyinfe/semi-ui';

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
    prompt: `请生成一张写实风格的人物写真照片。

人物设定：
- 主体为 25-30 岁亚洲女性，气质自然松弛，微笑克制不过度夸张
- 穿着简洁浅色针织上衣，妆容清透，发丝自然、有轻微层次
- 场景为靠窗的室内空间（咖啡馆或公寓一角），背景有少量虚化生活元素

拍摄要求：
- 必须呈现真实相机质感，不要卡通、插画、3D 渲染或过度磨皮
- 以自然侧逆光为主，保留皮肤真实纹理和细小明暗过渡
- 构图以半身或近景为主，焦点在眼睛，背景干净不过分杂乱
- 色彩克制、偏胶片纪实风，避免饱和度过高和过强滤镜感
- 不要出现文字、Logo、水印、海报排版或 UI 元素
- 竖向画幅，适合作为社交媒体人物封面图`,
  },
  {
    key: 'food',
    label: '美食摄影',
    prompt: `请生成一张高级餐厅风格的写实美食摄影图。

菜品设定：
- 主菜为刚出炉的炭烤三文鱼配时令蔬菜，表面有细腻焦化纹理与轻微油光
- 旁边点缀柠檬角、海盐颗粒和少量香草，餐具为深色陶盘与亚麻餐巾
- 桌面材质为深胡桃木，环境带一点开放式厨房的暖色背景虚化光点

拍摄要求：
- 必须是逼真的相机拍摄观感，不要插画、3D 渲染、拼贴或广告合成痕迹
- 使用柔和侧光并保留食物高光与阴影层次，突出食材新鲜度
- 可见轻微热气或油脂反光，强化“刚出炉”的现场感
- 构图简洁高级，主次清晰，强调食物主体的体积感和纹理细节
- 不要出现文字、Logo、水印、菜单排版或 UI 元素
- 横向画幅，适合餐厅官网 Banner 或品牌宣传图`,
  },
];

const IMAGE_CHAT_HISTORY_KEY = 'image-chat-history';
const MAX_HISTORY_ITEMS = 8;

export default function ImageChat() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(PROMPT_TEMPLATES[0].prompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageBase64, setImageBase64] = useState('');
  const [historyItems, setHistoryItems] = useState([]);

  useEffect(() => {
    try {
      const rawHistory = window.localStorage.getItem(IMAGE_CHAT_HISTORY_KEY);
      if (!rawHistory) {
        return;
      }
      const parsedHistory = JSON.parse(rawHistory);
      if (Array.isArray(parsedHistory)) {
        setHistoryItems(parsedHistory);
      }
    } catch {
      setHistoryItems([]);
    }
  }, []);

  const persistHistory = (newHistoryItems) => {
    setHistoryItems(newHistoryItems);
    try {
      window.localStorage.setItem(IMAGE_CHAT_HISTORY_KEY, JSON.stringify(newHistoryItems));
    } catch {
      // ignore local storage write errors
    }
  };

  const saveToHistory = (newPrompt, newImageBase64, durationMs) => {
    const item = {
      id: `${Date.now()}`,
      prompt: newPrompt,
      imageBase64: newImageBase64,
      createdAt: new Date().toISOString(),
      durationMs,
    };

    const deduplicatedItems = historyItems.filter(
      (historyItem) => !(historyItem.prompt === newPrompt && historyItem.imageBase64 === newImageBase64),
    );
    const nextHistoryItems = [item, ...deduplicatedItems].slice(0, MAX_HISTORY_ITEMS);
    persistHistory(nextHistoryItems);
  };

  const downloadImage = (base64, customName) => {
    if (!base64) {
      return;
    }
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64}`;
    link.download = customName || `image-chat-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const runGenerate = async () => {
    if (!prompt.trim()) {
      showError(t('请输入图像描述。'));
      return;
    }

    setIsGenerating(true);
    const generateStartAt = Date.now();
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
      saveToHistory(prompt, imageCall.result, Date.now() - generateStartAt);
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
          rows={14}
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
          <div style={{ marginBottom: 12 }}>
            <Button onClick={() => downloadImage(imageBase64)}>{t('下载图片')}</Button>
          </div>
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={t('生成图片结果')}
            style={{ width: '100%', borderRadius: 8 }}
          />
        </Card>
      ) : null}

      {historyItems.length ? (
        <Card title={t('最近生成记录')} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {historyItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: 12 }}>
                <div style={{ marginBottom: 8, color: 'var(--semi-color-text-2)' }}>{item.prompt}</div>
                <div style={{ marginBottom: 8, color: 'var(--semi-color-text-2)' }}>
                  {t('耗时：{{seconds}} 秒', { seconds: ((item.durationMs || 0) / 1000).toFixed(2) })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <Button theme='light' onClick={() => setPrompt(item.prompt)}>
                    {t('使用此提示词')}
                  </Button>
                  <Button theme='light' onClick={() => setImageBase64(item.imageBase64)}>
                    {t('查看此结果')}
                  </Button>
                  <Button theme='light' onClick={() => downloadImage(item.imageBase64, `image-chat-${item.id}.png`)}>
                    {t('下载')}
                  </Button>
                </div>
                <img
                  src={`data:image/png;base64,${item.imageBase64}`}
                  alt={t('历史生成图片')}
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
