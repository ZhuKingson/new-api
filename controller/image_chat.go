package controller

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type imageChatGenerateRequest struct {
	Prompt string `json:"prompt" binding:"required"`
}

func tokenSupportsModel(token *model.Token, modelName string) bool {
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

func selectAvailableImageToken(userId int, modelName string) *model.Token {
	tokens, err := model.GetAllUserTokens(userId, 0, 200)
	if err != nil {
		common.SysError("selectAvailableImageToken failed: " + err.Error())
		return nil
	}
	now := common.GetTimestamp()
	for _, token := range tokens {
		if token.Status != common.TokenStatusEnabled {
			continue
		}
		if token.ExpiredTime != -1 && token.ExpiredTime < now {
			continue
		}
		if !token.UnlimitedQuota && token.RemainQuota <= 0 {
			continue
		}
		if !tokenSupportsModel(token, modelName) {
			continue
		}
		return token
	}
	return nil
}

func ImageChatGenerate(c *gin.Context) {
	var req imageChatGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		common.ApiError(c, fmt.Errorf("prompt is required"))
		return
	}

	token := selectAvailableImageToken(c.GetInt("id"), "gpt-5.5")
	if token == nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "未找到可用令牌：需启用、未过期、有额度且支持 gpt-5.5"})
		return
	}

	payload := map[string]any{
		"model":       "gpt-5.5",
		"stream":      false,
		"input":       []any{map[string]any{"role": "user", "content": []any{map[string]any{"type": "input_text", "text": prompt}}}},
		"tools":       []any{map[string]any{"type": "image_generation", "model": "gpt-image-2", "action": "generate", "size": "1536x1024", "quality": "high", "output_format": "png"}},
		"tool_choice": map[string]any{"type": "image_generation"},
	}
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
