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
import {
  Button,
  Card,
  Popconfirm,
  Select,
  Space,
  Tabs,
  TextArea,
  Typography,
  Upload,
} from '@douyinfe/semi-ui';
import {
  IMAGE_CHAT_MODES,
  buildImageChatFormData,
  extractImageBase64FromRelayResponse,
  getNativeReferenceFile,
  validateImageChatInput,
} from './image-chat-utils';

const { Text } = Typography;

const TEXT_PROMPT_TEMPLATES = [
  {
    key: 'product-photo',
    label: '产品摄影',
    prompt:
      '生成一张真实感很强的产品摄影图，主体是一只温润米白色陶瓷香薰加湿器，放在木质边几上，自然窗光，柔和阴影，浅景深，背景干净真实，不要文字、Logo、水印或 UI 元素。',
  },
  {
    key: 'hero-banner',
    label: '官网主视觉',
    prompt:
      '生成一张产品官网 Hero 图，主体突出、背景简洁，光影自然，画面有真实摄影质感，避免文字和水印。',
  },
  {
    key: 'social-cover',
    label: '社媒封面',
    prompt:
      '生成一张适合社交媒体封面的图像，构图清晰，色彩有层次，突出主体，真实摄影风格，不要文字和 logo。',
  },
];

const IMAGE_PROMPT_TEMPLATES = [
  {
    key: 'scene-edit',
    label: '商品场景改图',
    prompt:
      '保留上传图片中产品的外形、比例、颜色和材质，不要改变产品结构，只改变背景、光线和拍摄场景。',
  },
  {
    key: 'background-replace',
    label: '更换背景',
    prompt:
      '保留参考图主体的结构、比例、颜色和材质，将背景更换为干净高级的室内自然光场景，主体边缘自然融合。',
  },
  {
    key: 'quality-polish',
    label: '质感增强',
    prompt:
      '基于参考图优化画面质感、光影和清晰度，保留主体身份和结构，不改变产品关键细节，不添加文字或水印。',
  },
];

const RATIO_OPTIONS = [
  { label: '1:1（方图）', value: '1:1' },
  { label: '3:2（横版主视觉）', value: '3:2' },
  { label: '16:9（横版视频/网页）', value: '16:9' },
  { label: '2:3（竖版）', value: '2:3' },
  { label: '9:16（手机竖图）', value: '9:16' },
  { label: '4:5（电商详情）', value: '4:5' },
  { label: '21:9（横幅）', value: '21:9' },
];
const RESOLUTION_OPTIONS = [
  { label: '1K', value: '1k' },
  { label: '2K', value: '2k' },
];
const QUALITY_OPTIONS = [
  { label: 'auto', value: 'auto' },
  { label: 'low', value: 'low' },
  { label: 'medium', value: 'medium' },
  { label: 'high', value: 'high' },
];
const OUTPUT_FORMAT_OPTIONS = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WEBP', value: 'webp' },
];

const RESOLVED_SIZE_MAP = {
  '1:1': { '1k': '1024x1024', '2k': '2048x2048' },
  '3:2': { '1k': '1536x1024', '2k': '2304x1536' },
  '16:9': { '1k': '1024x576', '2k': '2048x1152' },
  '2:3': { '1k': '1024x1536', '2k': '1536x2304' },
  '9:16': { '1k': '576x1024', '2k': '1152x2048' },
  '4:5': { '1k': '1024x1280', '2k': '1536x1920' },
  '21:9': { '1k': '1344x576', '2k': '2560x1088' },
};

const OUTPUT_FORMAT_MIME_MAP = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const IMAGE_CHAT_HISTORY_KEY = 'image-chat-history';
const MAX_HISTORY_ITEMS = 8;
const MAX_REFERENCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_HISTORY_STORAGE_BYTES = 4 * 1024 * 1024;

const estimateBytes = (value) =>
  new Blob([typeof value === 'string' ? value : JSON.stringify(value || '')])
    .size;

const normalizeHistory = (input) => {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .filter((item) => item?.imageBase64 && item?.prompt)
    .slice(0, MAX_HISTORY_ITEMS);
  const result = [];
  let totalBytes = 0;
  for (const item of normalized) {
    const nextBytes = estimateBytes(item);
    if (totalBytes + nextBytes > MAX_HISTORY_STORAGE_BYTES) break;
    totalBytes += nextBytes;
    result.push(item);
  }
  return result;
};

export default function ImageChat() {
  const { t } = useTranslation();
  const [mode, setMode] = useState(IMAGE_CHAT_MODES.text);
  const [promptByMode, setPromptByMode] = useState({
    [IMAGE_CHAT_MODES.text]: TEXT_PROMPT_TEMPLATES[0].prompt,
    [IMAGE_CHAT_MODES.image]: IMAGE_PROMPT_TEMPLATES[0].prompt,
  });
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState('2k');
  const [quality, setQuality] = useState('high');
  const [outputFormat, setOutputFormat] = useState('png');
  const [referenceFile, setReferenceFile] = useState(null);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState(
    OUTPUT_FORMAT_MIME_MAP.png,
  );
  const [historyItems, setHistoryItems] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const prompt = promptByMode[mode];
  const resolvedSize = useMemo(
    () => RESOLVED_SIZE_MAP?.[ratio]?.[resolution] || '-',
    [ratio, resolution],
  );

  useEffect(() => {
    if (!referenceFile) {
      setReferencePreviewUrl('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(referenceFile);
    setReferencePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [referenceFile]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(IMAGE_CHAT_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const normalized = normalizeHistory(parsed);
      setHistoryItems(normalized);
      window.localStorage.setItem(
        IMAGE_CHAT_HISTORY_KEY,
        JSON.stringify(normalized),
      );
    } catch {
      setHistoryItems([]);
    }
  }, []);

  const setPromptForMode = (targetMode, nextPrompt) => {
    setPromptByMode((prev) => ({ ...prev, [targetMode]: nextPrompt }));
  };

  const persistHistory = (items) => {
    const normalized = normalizeHistory(items);
    setHistoryItems(normalized);
    try {
      window.localStorage.setItem(
        IMAGE_CHAT_HISTORY_KEY,
        JSON.stringify(normalized),
      );
    } catch {
      showError(t('最近记录写入失败，请手动清理浏览器存储。'));
    }
  };

  const saveToHistory = (
    newPrompt,
    newImageBase64,
    durationMs,
    requestMode,
  ) => {
    const item = {
      id: `${Date.now()}`,
      prompt: newPrompt,
      imageBase64: newImageBase64,
      durationMs,
      ratio,
      resolution,
      quality,
      outputFormat,
      mode: requestMode,
      createdAt: new Date().toISOString(),
    };
    const deduped = [
      item,
      ...historyItems.filter(
        (x) =>
          !(x.prompt === item.prompt && x.imageBase64 === item.imageBase64),
      ),
    ];
    persistHistory(deduped);
  };

  const deleteHistoryItem = (id) => {
    persistHistory(historyItems.filter((x) => x.id !== id));
  };

  const clearAllHistory = () => {
    persistHistory([]);
    showSuccess(t('已清空最近生成记录。'));
  };

  const handleReferenceUpload = (file) => {
    const fileInstance = getNativeReferenceFile(file);
    if (!fileInstance) {
      showError(t('无效图片，请重新选择。'));
      return false;
    }
    const fileSize = fileInstance?.size || 0;
    if (fileSize > MAX_REFERENCE_IMAGE_BYTES) {
      showError(t('参考图不能超过 20MB。'));
      return false;
    }
    if (
      fileInstance?.type &&
      !['image/png', 'image/jpeg', 'image/webp'].includes(fileInstance.type)
    ) {
      showError(t('仅支持 PNG/JPEG/WEBP 参考图。'));
      return false;
    }
    setReferenceFile(fileInstance || null);
    return false;
  };

  const runGenerate = async () => {
    const validation = validateImageChatInput({ prompt, mode, referenceFile });
    if (validation === 'prompt_required')
      return showError(t('请输入图像描述。'));
    if (validation === 'reference_image_required')
      return showError(t('图生图需要先上传参考图。'));

    setIsGenerating(true);
    const startedAt = Date.now();
    const formData = buildImageChatFormData({
      prompt,
      mode,
      ratio,
      resolution,
      quality,
      outputFormat,
      referenceFile,
    });

    try {
      const res = await API.post('/api/user/image-chat/generate', formData, {
        timeout: 180000,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { success, message } = res.data || {};
      if (success === false) return showError(message || t('图像生成失败。'));
      const imageResult = extractImageBase64FromRelayResponse(res.data);
      if (!imageResult)
        return showError(message || t('模型没有返回图像结果。'));
      setImageBase64(imageResult);
      setImageMimeType(
        OUTPUT_FORMAT_MIME_MAP[outputFormat] || OUTPUT_FORMAT_MIME_MAP.png,
      );
      saveToHistory(prompt, imageResult, Date.now() - startedAt, mode);
      showSuccess(t('图像生成成功。'));
    } catch (error) {
      showError(error?.response?.data?.message || t('图像生成失败。'));
    } finally {
      setIsGenerating(false);
    }
  };

  const renderPromptEditor = (targetMode) => {
    const targetPrompt = promptByMode[targetMode];
    const targetTemplates =
      targetMode === IMAGE_CHAT_MODES.image
        ? IMAGE_PROMPT_TEMPLATES
        : TEXT_PROMPT_TEMPLATES;

    return (
      <>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          {targetTemplates.map((template) => (
            <Button
              key={template.key}
              theme='borderless'
              onClick={() => setPromptForMode(targetMode, template.prompt)}
            >
              {template.label}
            </Button>
          ))}
        </div>
        <TextArea
          value={targetPrompt}
          onChange={(nextPrompt) => setPromptForMode(targetMode, nextPrompt)}
          rows={8}
          placeholder={
            targetMode === IMAGE_CHAT_MODES.image
              ? t('请输入要基于参考图修改的内容。')
              : t('请输入你想生成的图像描述。')
          }
        />
      </>
    );
  };

  const renderSettings = () => (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: 8,
          marginTop: 12,
        }}
      >
        <Select
          value={ratio}
          optionList={RATIO_OPTIONS}
          onChange={setRatio}
          placeholder={t('比例')}
        />
        <Select
          value={resolution}
          optionList={RESOLUTION_OPTIONS}
          onChange={setResolution}
          placeholder={t('分辨率档位')}
        />
        <Select
          value={quality}
          optionList={QUALITY_OPTIONS}
          onChange={setQuality}
          placeholder={t('生成质量')}
        />
        <Select
          value={outputFormat}
          optionList={OUTPUT_FORMAT_OPTIONS}
          onChange={setOutputFormat}
          placeholder={t('输出格式')}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <Text type='secondary'>
          {t('实际尺寸')}：{resolvedSize}
        </Text>
      </div>
    </>
  );

  const renderReferenceUploader = () => (
    <div style={{ marginTop: 12 }}>
      <Upload
        action=''
        draggable
        limit={1}
        accept='image/png,image/jpeg,image/webp'
        beforeUpload={handleReferenceUpload}
        onRemove={() => {
          setReferenceFile(null);
          return true;
        }}
        showUploadList
      />
      <div style={{ marginTop: 8 }}>
        <Text type='tertiary'>
          {t('参考图要求：PNG/JPEG/WEBP，且不超过 20MB。')}
        </Text>
      </div>
      {referencePreviewUrl ? (
        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <img
            src={referencePreviewUrl}
            alt={t('参考图预览')}
            style={{
              width: 160,
              height: 120,
              objectFit: 'cover',
              borderRadius: 8,
              border: '1px solid var(--semi-color-border)',
            }}
          />
          <div>
            <Text strong>{referenceFile?.name || t('参考图')}</Text>
            <br />
            <Text type='secondary'>
              {t('将基于这张图进行结构保留和局部改图。')}
            </Text>
          </div>
        </div>
      ) : null}
    </div>
  );

  let generateButtonText = t('生成图片');
  if (isGenerating) {
    generateButtonText = t('生成中...');
  } else if (mode === IMAGE_CHAT_MODES.image) {
    generateButtonText = t('生成改图');
  }

  return (
    <div
      style={{ maxWidth: 1080, margin: '64px auto 0', padding: '0 16px 16px' }}
    >
      <Card title={t('图像创作（GPT-5.5 + GPT-Image-2）')}>
        <Tabs activeKey={mode} onChange={setMode} type='button'>
          <Tabs.TabPane tab={t('文生图')} itemKey={IMAGE_CHAT_MODES.text}>
            <div style={{ marginTop: 12 }}>
              {renderPromptEditor(IMAGE_CHAT_MODES.text)}
              {renderSettings()}
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('图生图')} itemKey={IMAGE_CHAT_MODES.image}>
            <div style={{ marginTop: 12 }}>
              {renderReferenceUploader()}
              <div style={{ marginTop: 12 }}>
                {renderPromptEditor(IMAGE_CHAT_MODES.image)}
              </div>
              {renderSettings()}
            </div>
          </Tabs.TabPane>
        </Tabs>

        <div style={{ marginTop: 16 }}>
          <Button loading={isGenerating} onClick={runGenerate}>
            {generateButtonText}
          </Button>
        </div>
      </Card>

      {imageBase64 ? (
        <Card title={t('生成结果')} style={{ marginTop: 16 }}>
          <img
            src={`data:${imageMimeType};base64,${imageBase64}`}
            alt={t('生成图片结果')}
            style={{ width: '100%', borderRadius: 8 }}
          />
        </Card>
      ) : null}

      {historyItems.length > 0 ? (
        <Card title={t('最近生成记录')} style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 12 }}>
            <Text type='secondary'>
              {t('最多保留 {{count}} 条，且总缓存不超过 {{size}}MB。', {
                count: MAX_HISTORY_ITEMS,
                size: Math.floor(MAX_HISTORY_STORAGE_BYTES / 1024 / 1024),
              })}
            </Text>
            <Popconfirm
              title={t('确认清空全部记录吗？')}
              onConfirm={clearAllHistory}
            >
              <Button theme='light' type='danger'>
                {t('清空全部')}
              </Button>
            </Popconfirm>
          </Space>
          <div style={{ display: 'grid', gap: 16 }}>
            {historyItems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Text>{item.prompt}</Text>
                <div style={{ margin: '8px 0' }}>
                  <Text type='tertiary'>
                    {t('模式')}:{' '}
                    {item.mode === IMAGE_CHAT_MODES.image ||
                    item.action === 'edit'
                      ? t('图生图')
                      : t('文生图')}{' '}
                    | {t('参数')}: {item.ratio} / {item.resolution} /{' '}
                    {item.quality} / {item.outputFormat}
                  </Text>
                </div>
                <Space>
                  <Button
                    theme='light'
                    onClick={() => {
                      setImageBase64(item.imageBase64);
                      setImageMimeType(
                        OUTPUT_FORMAT_MIME_MAP[item.outputFormat] ||
                          OUTPUT_FORMAT_MIME_MAP.png,
                      );
                    }}
                  >
                    {t('查看')}
                  </Button>
                  <Button
                    theme='light'
                    onClick={() => {
                      const targetMode =
                        item.mode === IMAGE_CHAT_MODES.image ||
                        item.action === 'edit'
                          ? IMAGE_CHAT_MODES.image
                          : IMAGE_CHAT_MODES.text;
                      setMode(targetMode);
                      setPromptByMode((prev) => ({
                        ...prev,
                        [targetMode]: item.prompt,
                      }));
                    }}
                  >
                    {t('复用提示词')}
                  </Button>
                  <Popconfirm
                    title={t('确认删除这条记录吗？')}
                    onConfirm={() => deleteHistoryItem(item.id)}
                  >
                    <Button theme='light' type='danger'>
                      {t('删除')}
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
