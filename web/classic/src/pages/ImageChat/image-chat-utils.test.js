import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  IMAGE_CHAT_MODES,
  buildImageChatFormData,
  extractImageBase64FromRelayResponse,
  getNativeReferenceFile,
  validateImageChatInput,
} from './image-chat-utils.js';

describe('ImageChat request helpers', () => {
  test('builds a text-to-image request without reference image data', () => {
    const formData = buildImageChatFormData({
      prompt: '生成一张产品图',
      mode: IMAGE_CHAT_MODES.text,
      ratio: '16:9',
      resolution: '2k',
      quality: 'high',
      outputFormat: 'png',
      referenceFile: new Blob(['ignored'], { type: 'image/png' }),
    });

    assert.equal(formData.get('image_action'), 'generate');
    assert.equal(formData.has('reference_image'), false);
  });

  test('builds an image-to-image request with the reference image', () => {
    const referenceFile = new Blob(['image'], { type: 'image/png' });
    const formData = buildImageChatFormData({
      prompt: '保留主体，只改背景',
      mode: IMAGE_CHAT_MODES.image,
      ratio: '1:1',
      resolution: '1k',
      quality: 'medium',
      outputFormat: 'webp',
      referenceFile,
    });

    assert.equal(formData.get('image_action'), 'edit');
    const appendedFile = formData.get('reference_image');
    assert.equal(appendedFile instanceof Blob, true);
    assert.equal(appendedFile.size, referenceFile.size);
  });

  test('requires a reference image for image-to-image mode', () => {
    assert.equal(
      validateImageChatInput({
        prompt: '换一个背景',
        mode: IMAGE_CHAT_MODES.image,
        referenceFile: null,
      }),
      'reference_image_required',
    );
  });

  test('normalizes Semi Upload file wrappers to native files', () => {
    const referenceFile = new Blob(['image'], { type: 'image/png' });

    assert.equal(getNativeReferenceFile(referenceFile), referenceFile);
    assert.equal(
      getNativeReferenceFile({ fileInstance: referenceFile }),
      referenceFile,
    );
    assert.equal(
      getNativeReferenceFile({ file: referenceFile }),
      referenceFile,
    );
    assert.equal(
      getNativeReferenceFile({ file: { fileInstance: referenceFile } }),
      referenceFile,
    );
    assert.equal(
      getNativeReferenceFile({ file: { file: referenceFile } }),
      referenceFile,
    );
    assert.equal(getNativeReferenceFile({ fileInstance: {} }), null);
  });

  test('extracts image result from relay response variants', () => {
    const result = extractImageBase64FromRelayResponse({
      data: {
        output: [{ type: 'image_generation_call', result: 'base64-image' }],
      },
    });

    assert.equal(result, 'base64-image');
  });
});
