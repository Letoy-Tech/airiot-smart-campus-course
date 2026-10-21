package com.letoy.main.ai.service.impl;

import com.letoy.main.common.exception.SystemException;
import com.letoy.main.ai.service.AiChatService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.retry.NonTransientAiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;

@Slf4j
@Service
@ConditionalOnProperty(name = "spring.ai.model.chat", havingValue = "openai")
@ConditionalOnBean(ChatClient.class)
public class AiChatServiceImpl implements AiChatService {

    private final ChatClient chatClient;
    private final String baseUrl;
    private final String model;

    public AiChatServiceImpl(ChatClient chatClient,
                             @Value("${spring.ai.openai.base-url:}") String baseUrl,
                             @Value("${spring.ai.openai.chat.options.model:}") String model) {
        this.chatClient = chatClient;
        this.baseUrl = baseUrl;
        this.model = model;
    }

    @Override
    public String chat(String systemPrompt, String userMessage) {
        try {
            return buildPrompt(systemPrompt, userMessage)
                    .call()
                    .content();
        }
        catch (NonTransientAiException exception) {
            log.error("AI upstream request failed, baseUrl={}, model={}, message={}",
                    normalizeBaseUrl(baseUrl), model, exception.getMessage(), exception);
            throw exception;
        }
    }

    @Override
    public Flux<String> streamChat(String systemPrompt, String userMessage) {
        try {
            return buildPrompt(systemPrompt, userMessage)
                    .stream()
                    .content()
                    .doOnError(exception -> {
                        if (exception instanceof NonTransientAiException aiException) {
                            log.error("AI upstream stream failed, baseUrl={}, model={}, message={}",
                                    normalizeBaseUrl(baseUrl), model, aiException.getMessage(), aiException);
                        } else {
                            log.error("AI stream failed, baseUrl={}, model={}",
                                    normalizeBaseUrl(baseUrl), model, exception);
                        }
                    });
        }
        catch (NonTransientAiException exception) {
            log.error("AI upstream stream setup failed, baseUrl={}, model={}, message={}",
                    normalizeBaseUrl(baseUrl), model, exception.getMessage(), exception);
            throw exception;
        }
    }

    private ChatClient.ChatClientRequestSpec buildPrompt(String systemPrompt, String userMessage) {
        if (!StringUtils.hasText(userMessage)) {
            throw new SystemException("AI user message is required");
        }

        ChatClient.ChatClientRequestSpec requestSpec = chatClient.prompt();
        if (StringUtils.hasText(systemPrompt)) {
            requestSpec = requestSpec.system(systemPrompt);
        }
        return requestSpec.user(userMessage);
    }

    private String normalizeBaseUrl(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.trim();
        return normalized.endsWith("/") ? normalized.substring(0, normalized.length() - 1) : normalized;
    }
}
