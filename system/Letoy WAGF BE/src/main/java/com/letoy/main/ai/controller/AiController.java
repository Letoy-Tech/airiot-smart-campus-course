package com.letoy.main.ai.controller;

import com.letoy.main.ai.dto.request.ChatRequest;
import com.letoy.main.ai.dto.response.ChatResponse;
import com.letoy.main.ai.service.AiChatService;
import com.letoy.main.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

@RestController
@RequestMapping("/ai")
@Tag(name = "AI chat")
@ConditionalOnProperty(name = "spring.ai.model.chat", havingValue = "openai")
public class AiController {

    private final AiChatService aiChatService;

    public AiController(AiChatService aiChatService) {
        this.aiChatService = aiChatService;
    }

    @PostMapping("/chat")
    @Operation(summary = "Chat with the configured Spring AI model")
    public ApiResponse<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        String content = aiChatService.chat(request.getSystemPrompt(), request.getMessage());
        return ApiResponse.success(new ChatResponse(content));
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Stream chat responses from the configured Spring AI model")
    public SseEmitter streamChat(@Valid @RequestBody ChatRequest request) {
        SseEmitter emitter = new SseEmitter(0L);

        Disposable disposable = aiChatService.streamChat(request.getSystemPrompt(), request.getMessage())
                .subscribe(
                        chunk -> sendEvent(emitter, "delta", chunk),
                        exception -> {
                            sendEvent(emitter, "error", exception.getMessage() == null ? "AI stream failed" : exception.getMessage());
                            emitter.complete();
                        },
                        () -> {
                            sendEvent(emitter, "done", "[DONE]");
                            emitter.complete();
                        }
                );

        emitter.onCompletion(disposable::dispose);
        emitter.onTimeout(() -> {
            disposable.dispose();
            emitter.complete();
        });

        return emitter;
    }

    private void sendEvent(SseEmitter emitter, String eventName, String data) {
        try {
            emitter.send(SseEmitter.event().name(eventName).data(data == null ? "" : data));
        }
        catch (Exception exception) {
            throw new IllegalStateException("Failed to send SSE event", exception);
        }
    }
}
