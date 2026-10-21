package com.letoy.main.permission.assembler;

import com.letoy.main.permission.dto.request.ApiRuleCreateRequest;
import com.letoy.main.permission.entity.ApiRule;
import org.springframework.util.StringUtils;

public final class ApiRuleAssembler {

    private ApiRuleAssembler() {
    }

    public static ApiRule toEntity(ApiRuleCreateRequest request) {
        ApiRule apiRule = new ApiRule();
        apiRule.setName(request.getName());
        apiRule.setPattern(request.getPattern());
        apiRule.setMethods(StringUtils.hasText(request.getMethods()) ? request.getMethods() : null);
        apiRule.setGroupPolicy(request.getGroupPolicy());
        apiRule.setAllowedGroupIds(request.getAllowedGroupIds());
        apiRule.setGroupIdPathVar(request.getGroupIdPathVar());
        apiRule.setUserIdPathVar(request.getUserIdPathVar());
        apiRule.setPriority(request.getPriority() == null ? 0 : request.getPriority());
        apiRule.setEnabled(request.getEnabled() == null || request.getEnabled());
        return apiRule;
    }

    public static ApiRule toEntity(Long id, ApiRuleCreateRequest request) {
        ApiRule apiRule = toEntity(request);
        apiRule.setId(id);
        return apiRule;
    }
}
