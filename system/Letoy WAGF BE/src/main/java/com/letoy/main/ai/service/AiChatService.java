package com.letoy.main.ai.service;

import reactor.core.publisher.Flux;

public interface AiChatService {

    String chat(String systemPrompt, String userMessage);

    Flux<String> streamChat(String systemPrompt, String userMessage);
}
