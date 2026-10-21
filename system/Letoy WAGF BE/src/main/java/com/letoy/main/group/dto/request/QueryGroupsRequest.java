package com.letoy.main.group.dto.request;

import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class QueryGroupsRequest {

    @Positive(message = "Current page must be greater than 0")
    private Integer currentPage;

    @Positive(message = "Page size must be greater than 0")
    private Integer pageSize;

    private String groupName;
    private String parentGroupId;
}
