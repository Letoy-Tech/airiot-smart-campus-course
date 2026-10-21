package com.letoy.main.permission.assembler;

import com.letoy.main.permission.dto.response.ApiRuleResponse;
import com.letoy.main.permission.entity.ApiRule;

public final class ApiRuleResponseAssembler {

    private ApiRuleResponseAssembler() {
    }

    public static ApiRuleResponse toResponse(ApiRule apiRule) {
        if (apiRule == null) {
            return null;
        }
        return ApiRuleResponse.builder()
                .id(apiRule.getId())
                .name(apiRule.getName())
                .pattern(apiRule.getPattern())
                .methods(apiRule.getMethods())
                .groupPolicy(apiRule.getGroupPolicy())
                .allowedGroupIds(apiRule.getAllowedGroupIds())
                .groupIdPathVar(apiRule.getGroupIdPathVar())
                .userIdPathVar(apiRule.getUserIdPathVar())
                .priority(apiRule.getPriority())
                .enabled(apiRule.getEnabled())
                .createdAt(apiRule.getCreatedAt())
                .updatedAt(apiRule.getUpdatedAt())
                .build();
    }
}
