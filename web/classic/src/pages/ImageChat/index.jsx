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

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import { Button, Card, Popconfirm, Radio, RadioGroup, Select, Space, TextArea, Typography, Upload } from '@douyinfe/semi-ui';

const { Text } = Typography;

const PROMPT_TEMPLATES = [
  { key: 'product-photo', label: '商品场景改图', prompt: '保留上传图片中产品的外形、比例、颜色和材质，不要改变产品结构，只改变背景、光线和拍摄场景。' },
  { key: 'hero-banner', label: '官网主视觉', prompt: '生成一张产品官网 Hero 图，主体突出、背景简洁，光影自然，避免文字和水印。' },
  { key: 'social-cover', label: '社媒封面', prompt: '生成一张适合社交媒体封面的图像，构图清晰，色彩有层次，突出主体。' },
];

const RATIO_OPTIONS = [
  { label: '1:1（方图）', value: '1:1' }, { label: '3:2（横版主视觉）', value: '3:2' }, { label: '16:9（横版视频/网页）', value: '16:9' },
  { label: '2:3（竖版）', value: '2:3' }, { label: '9:16（手机竖图）', value: '9:16' }, { label: '4:5（电商详情）', value: '4:5' }, { label: '21:9（横幅）', value: '21:9' },
];
const RESOLUTION_OPTIONS = [{ label: '1K', value: '1k' }, { label: '2K', value: '2k' }];
const QUALITY_OPTIONS = [{ label: 'auto', value: 'auto' }, { label: 'low', value: 'low' }, { label: 'medium', value: 'medium' }, { label: 'high', value: 'high' }];
const OUTPUT_FORMAT_OPTIONS = [{ label: 'PNG', value: 'png' }, { label: 'JPEG', value: 'jpeg' }, { label: 'WEBP', value: 'webp' }];
const ACTION_OPTIONS = [{ label: '文生图（generate）', value: 'generate' }, { label: '参考图（auto）', value: 'auto' }, { label: '基于原图改图（edit）', value: 'edit' }];

const RESOLVED_SIZE_MAP = {
  '1:1': { '1k': '1024x1024', '2k': '2048x2048' }, '3:2': { '1k': '1536x1024', '2k': '2304x1536' }, '16:9': { '1k': '1024x576', '2k': '2048x1152' },
  '2:3': { '1k': '1024x1536', '2k': '1536x2304' }, '9:16': { '1k': '576x1024', '2k': '1152x2048' }, '4:5': { '1k': '1024x1280', '2k': '1536x1920' }, '21:9': { '1k': '1344x576', '2k': '2560x1088' },
};

const IMAGE_CHAT_HISTORY_KEY = 'image-chat-history';
const MAX_HISTORY_ITEMS = 8;
const MAX_REFERENCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_HISTORY_STORAGE_BYTES = 4 * 1024 * 1024;

const estimateBytes = (value) => new Blob([typeof value === 'string' ? value : JSON.stringify(value || '')]).size;

const normalizeHistory = (input) => {
  if (!Array.isArray(input)) return [];
  const normalized = input.filter((item) => item?.imageBase64 && item?.prompt).slice(0, MAX_HISTORY_ITEMS);
  const result = [];
  let totalBytes = 0;
  for (const item of normalized) {
    const nextBytes = estimateBytes(item);
    if (totalBytes+ nextBytes > MAX_HISTORY_STORAGE_BYTES) break;
    totalBytes += nextBytes;
    result.push(item);
  }
  return result;
};

export default function ImageChat() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(PROMPT_TEMPLATES[0].prompt);
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState('2k');
  const [quality, setQuality] = useState('high');
  const [outputFormat, setOutputFormat] = useState('png');
  const [action, setAction] = useState('generate');
  const [referenceFile, setReferenceFile] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [historyItems, setHistoryItems] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const resolvedSize = useMemo(() => RESOLVED_SIZE_MAP?.[ratio]?.[resolution] || '-', [ratio, resolution]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(IMAGE_CHAT_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const normalized = normalizeHistory(parsed);
      setHistoryItems(normalized);
      window.localStorage.setItem(IMAGE_CHAT_HISTORY_KEY, JSON.stringify(normalized));
    } catch {
      setHistoryItems([]);
    }
  }, []);

  const persistHistory = (items) => {
    const normalized = normalizeHistory(items);
    setHistoryItems(normalized);
    try {
      window.localStorage.setItem(IMAGE_CHAT_HISTORY_KEY, JSON.stringify(normalized));
    } catch {
      showError(t('最近记录写入失败，请手动清理浏览器存储。'));
    }
  };

  const saveToHistory = (newPrompt, newImageBase64, durationMs) => {
    const item = { id: `${Date.now()}`, prompt: newPrompt, imageBase64: newImageBase64, durationMs, ratio, resolution, quality, outputFormat, action, createdAt: new Date().toISOString() };
    const deduped = [item, ...historyItems.filter((x) => !(x.prompt === item.prompt && x.imageBase64 === item.imageBase64))];
    persistHistory(deduped);
  };

  const deleteHistoryItem = (id) => {
    persistHistory(historyItems.filter((x) => x.id !== id));
  };

  const clearAllHistory = () => {
    persistHistory([]);
    showSuccess(t('已清空最近生成记录。'));
  };

  const runGenerate = async () => {
    if (!prompt.trim()) return showError(t('请输入图像描述。'));
    if (action === 'edit' && !referenceFile) return showError(t('选择 edit 模式时必须上传参考图。'));

    setIsGenerating(true);
    const startedAt = Date.now();
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('image_ratio', ratio);
    formData.append('image_resolution', resolution);
    formData.append('image_quality', quality);
    formData.append('image_output_format', outputFormat);
    formData.append('image_action', action);
    if (referenceFile) formData.append('reference_image', referenceFile);

    try {
      const res = await API.post('/api/user/image-chat/generate', formData, { timeout: 180000, headers: { 'Content-Type': 'multipart/form-data' } });
      const { success, message, data, output } = res.data || {};
      if (success === false) return showError(message || t('图像生成失败。'));
      const imageCall = (data?.output || output || []).find((item) => item?.type === 'image_generation_call' && item?.result);
      if (!imageCall?.result) return showError(message || t('模型没有返回图像结果。'));
      setImageBase64(imageCall.result);
      saveToHistory(prompt, imageCall.result, Date.now() - startedAt);
      showSuccess(t('图像生成成功。'));
    } catch (error) {
      showError(error?.response?.data?.message || t('图像生成失败。'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: 1080, margin: '64px auto 0', padding: '0 16px 16px' }}>
      <Card title={t('文生图 / 图生图（GPT-5.5 + GPT-Image-2）')}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {PROMPT_TEMPLATES.map((template) => <Button key={template.key} theme='borderless' onClick={() => setPrompt(template.prompt)}>{template.label}</Button>)}
        </div>
        <TextArea value={prompt} onChange={setPrompt} rows={8} placeholder={t('请输入你想生成的图像描述。')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, marginTop: 12 }}>
          <Select value={ratio} optionList={RATIO_OPTIONS} onChange={setRatio} placeholder={t('比例')} />
          <Select value={resolution} optionList={RESOLUTION_OPTIONS} onChange={setResolution} placeholder={t('分辨率档位')} />
          <Select value={quality} optionList={QUALITY_OPTIONS} onChange={setQuality} placeholder={t('生成质量')} />
          <Select value={outputFormat} optionList={OUTPUT_FORMAT_OPTIONS} onChange={setOutputFormat} placeholder={t('输出格式')} />
        </div>
        <div style={{ marginTop: 8 }}><Text type='secondary'>{t('实际尺寸')}：{resolvedSize}</Text></div>
        <div style={{ marginTop: 12 }}><RadioGroup type='button' value={action} onChange={(e) => setAction(e.target.value)}>{ACTION_OPTIONS.map((item) => <Radio key={item.value} value={item.value}>{item.label}</Radio>)}</RadioGroup></div>
        <div style={{ marginTop: 12 }}>
          <Upload action='' limit={1} accept='image/png,image/jpeg,image/webp' beforeUpload={(file) => {
            const fileSize = file?.fileInstance?.size || 0;
            if (fileSize > MAX_REFERENCE_IMAGE_BYTES) {
              showError(t('参考图不能超过 20MB。'));
              return false;
            }
            setReferenceFile(file.fileInstance || null);
            return false;
          }} onRemove={() => setReferenceFile(null)} showUploadList />
          <Text type='tertiary'>{t('参考图要求：PNG/JPEG/WEBP，且不超过 20MB。建议提示词：保留上传图片中产品的外形、比例、颜色和材质，不要改变产品结构，只改变背景、光线和拍摄场景。')}</Text>
        </div>
        <div style={{ marginTop: 12 }}><Button loading={isGenerating} onClick={runGenerate}>{isGenerating ? t('生成中...') : t('生成图片')}</Button></div>
      </Card>

      {imageBase64 ? <Card title={t('生成结果')} style={{ marginTop: 16 }}><img src={`data:image/png;base64,${imageBase64}`} alt={t('生成图片结果')} style={{ width: '100%', borderRadius: 8 }} /></Card> : null}

      {historyItems.length > 0 ? (
        <Card title={t('最近生成记录')} style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 12 }}>
            <Text type='secondary'>{t('最多保留 {{count}} 条，且总缓存不超过 {{size}}MB。', { count: MAX_HISTORY_ITEMS, size: Math.floor(MAX_HISTORY_STORAGE_BYTES / 1024 / 1024) })}</Text>
            <Popconfirm title={t('确认清空全部记录吗？')} onConfirm={clearAllHistory}><Button theme='light' type='danger'>{t('清空全部')}</Button></Popconfirm>
          </Space>
          <div style={{ display: 'grid', gap: 16 }}>
            {historyItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: 12 }}>
                <Text>{item.prompt}</Text>
                <div style={{ margin: '8px 0' }}>
                  <Text type='tertiary'>{t('模式')}: {item.action} | {t('参数')}: {item.ratio} / {item.resolution} / {item.quality} / {item.outputFormat}</Text>
                </div>
                <Space>
                  <Button theme='light' onClick={() => setImageBase64(item.imageBase64)}>{t('查看')}</Button>
                  <Button theme='light' onClick={() => setPrompt(item.prompt)}>{t('复用提示词')}</Button>
                  <Popconfirm title={t('确认删除这条记录吗？')} onConfirm={() => deleteHistoryItem(item.id)}><Button theme='light' type='danger'>{t('删除')}</Button></Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
