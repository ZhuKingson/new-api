package controller

import (
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type imageChatGenerateRequest struct {
	Prompt            string `json:"prompt" form:"prompt" binding:"required"`
	ImageRatio        string `json:"image_ratio" form:"image_ratio"`
	ImageResolution   string `json:"image_resolution" form:"image_resolution"`
	ImageQuality      string `json:"image_quality" form:"image_quality"`
	ImageOutputFormat string `json:"image_output_format" form:"image_output_format"`
	ImageAction       string `json:"image_action" form:"image_action"`
}

const maxReferenceImageBytes int64 = 20 * 1024 * 1024

func normalizeDetectedImageMimeType(contentType string) string {
	switch strings.ToLower(strings.TrimSpace(contentType)) {
	case "image/png":
		return "image/png"
	case "image/jpeg":
		return "image/jpeg"
	case "image/webp":
		return "image/webp"
	default:
		return ""
	}
}

var imagePresetMap = map[string]map[string]string{
	"1:1":  {"1k": "1024x1024", "2k": "2048x2048"},
	"3:2":  {"1k": "1536x1024", "2k": "2304x1536"},
	"16:9": {"1k": "1024x576", "2k": "2048x1152"},
	"2:3":  {"1k": "1024x1536", "2k": "1536x2304"},
	"9:16": {"1k": "576x1024", "2k": "1152x2048"},
	"4:5":  {"1k": "1024x1280", "2k": "1536x1920"},
	"21:9": {"1k": "1344x576", "2k": "2560x1088"},
}

func tokenSupportsModel(token *model.Token, modelName string) bool { /* unchanged */
	if token == nil {
		return false
	}
	if !token.ModelLimitsEnabled {
		return true
	}
	limits := token.GetModelLimitsMap()
	if len(limits) == 0 {
		return false
	}
	_, ok := limits[modelName]
	return ok
}
func selectAvailableImageToken(userId int, modelName string) *model.Token { /* unchanged */
	tokens, err := model.GetAllUserTokens(userId, 0, 200)
	if err != nil {
		common.SysError("selectAvailableImageToken failed: " + err.Error())
		return nil
	}
	now := common.GetTimestamp()
	for _, token := range tokens {
		if token.Status != common.TokenStatusEnabled || (token.ExpiredTime != -1 && token.ExpiredTime < now) || (!token.UnlimitedQuota && token.RemainQuota <= 0) || !tokenSupportsModel(token, modelName) {
			continue
		}
		return token
	}
	return nil
}

func encodeImageToDataURL(file *multipart.FileHeader) (string, error) {
	if file == nil {
		return "", nil
	}
	if file.Size > maxReferenceImageBytes {
		return "", fmt.Errorf("参考图不能超过 20MB")
	}
	if file.Header == nil {
		return "", fmt.Errorf("无效图片")
	}
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()
	headerBuf := make([]byte, 512)
	n, _ := io.ReadFull(src, headerBuf)
	detectedMimeType := normalizeDetectedImageMimeType(http.DetectContentType(headerBuf[:n]))
	if detectedMimeType == "" {
		return "", fmt.Errorf("仅支持 PNG/JPEG/WEBP")
	}
	if _, err = src.Seek(0, io.SeekStart); err != nil {
		return "", err
	}
	buf, err := io.ReadAll(src)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("data:%s;base64,%s", detectedMimeType, base64.StdEncoding.EncodeToString(buf)), nil
}

func normalizeImageAction(v string) string {
	action := strings.ToLower(strings.TrimSpace(v))
	switch action {
	case "auto", "edit", "generate":
		return action
	default:
		return "generate"
	}
}

func normalizeImageQuality(v string) string {
	quality := strings.ToLower(strings.TrimSpace(v))
	switch quality {
	case "auto", "low", "medium", "high":
		return quality
	default:
		return "high"
	}
}

func normalizeImageOutputFormat(v string) string {
	format := strings.ToLower(strings.TrimSpace(v))
	switch format {
	case "png", "jpeg", "webp":
		return format
	default:
		return "png"
	}
}

func ImageChatGenerate(c *gin.Context) {
	var req imageChatGenerateRequest
	if err := c.ShouldBind(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		common.ApiError(c, fmt.Errorf("prompt is required"))
		return
	}
	action := normalizeImageAction(req.ImageAction)
	size := "1536x1024"
	if levels, ok := imagePresetMap[req.ImageRatio]; ok {
		if mapped, ok2 := levels[strings.ToLower(req.ImageResolution)]; ok2 {
			size = mapped
		}
	}
	quality := normalizeImageQuality(req.ImageQuality)
	format := normalizeImageOutputFormat(req.ImageOutputFormat)
	referenceImage, _ := c.FormFile("reference_image")
	dataURL, err := encodeImageToDataURL(referenceImage)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if action == "edit" && dataURL == "" {
		common.ApiError(c, fmt.Errorf("edit 模式必须上传参考图"))
		return
	}

	content := []any{map[string]any{"type": "input_text", "text": prompt}}
	if dataURL != "" {
		content = []any{map[string]any{"type": "input_text", "text": "基于这张图，" + prompt}, map[string]any{"type": "input_image", "image_url": dataURL}}
	}
	token := selectAvailableImageToken(c.GetInt("id"), "gpt-5.5")
	if token == nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "未找到可用令牌：需启用、未过期、有额度且支持 gpt-5.5"})
		return
	}
	payload := map[string]any{"model": "gpt-5.5", "stream": false, "input": []any{map[string]any{"role": "user", "content": content}}, "tools": []any{map[string]any{"type": "image_generation", "model": "gpt-image-2", "action": action, "size": size, "quality": quality, "output_format": format}}, "tool_choice": map[string]any{"type": "image_generation"}}
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Request.Method = http.MethodPost
	c.Request.URL.Path = "/v1/responses"
	c.Request.Body = io.NopCloser(strings.NewReader(string(payloadBytes)))
	c.Request.ContentLength = int64(len(payloadBytes))
	c.Request.Header.Set("Content-Type", "application/json")
	if err = middleware.SetupContextForToken(c, token); err != nil {
		common.ApiError(c, err)
		return
	}
	middleware.Distribute()(c)
	if c.IsAborted() {
		return
	}
	Relay(c, types.RelayFormatOpenAIResponses)
}
