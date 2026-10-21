package com.letoy.main.ai.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChatRequest {

    private String systemPrompt;

    @NotBlank(message = "Message is required")
    private String message;
}
