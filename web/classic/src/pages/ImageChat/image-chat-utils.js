export const IMAGE_CHAT_MODES = {
  text: 'text-to-image',
  image: 'image-to-image',
};

export const IMAGE_ACTION_BY_MODE = {
  [IMAGE_CHAT_MODES.text]: 'generate',
  [IMAGE_CHAT_MODES.image]: 'edit',
};

export function validateImageChatInput({ prompt, mode, referenceFile }) {
  if (!prompt?.trim()) {
    return 'prompt_required';
  }
  if (mode === IMAGE_CHAT_MODES.image && !referenceFile) {
    return 'reference_image_required';
  }
  return null;
}

export function getNativeReferenceFile(file) {
  if (file instanceof Blob) {
    return file;
  }
  if (file?.fileInstance instanceof Blob) {
    return file.fileInstance;
  }
  if (file?.originFileObj instanceof Blob) {
    return file.originFileObj;
  }
  if (file?.file instanceof Blob) {
    return file.file;
  }
  if (file?.file?.fileInstance instanceof Blob) {
    return file.file.fileInstance;
  }
  if (file?.file?.originFileObj instanceof Blob) {
    return file.file.originFileObj;
  }
  if (file?.file?.file instanceof Blob) {
    return file.file.file;
  }
  return null;
}

export function buildImageChatFormData({
  prompt,
  mode,
  ratio,
  resolution,
  quality,
  outputFormat,
  referenceFile,
}) {
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('image_ratio', ratio);
  formData.append('image_resolution', resolution);
  formData.append('image_quality', quality);
  formData.append('image_output_format', outputFormat);
  formData.append(
    'image_action',
    IMAGE_ACTION_BY_MODE[mode] || IMAGE_ACTION_BY_MODE[IMAGE_CHAT_MODES.text],
  );
  if (mode === IMAGE_CHAT_MODES.image && referenceFile) {
    formData.append('reference_image', referenceFile);
  }
  return formData;
}

export function extractImageBase64FromRelayResponse(responseData) {
  const output = responseData?.data?.output || responseData?.output || [];
  const imageCall = output.find(
    (item) => item?.type === 'image_generation_call' && item?.result,
  );
  return imageCall?.result || '';
}
