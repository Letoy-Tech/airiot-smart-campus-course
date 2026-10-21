package com.letoy.main.common.assembler;

import com.github.pagehelper.PageInfo;
import com.letoy.main.common.dto.response.PageResponse;

import java.util.List;
import java.util.function.Function;

public final class PageResponseAssembler {

    private PageResponseAssembler() {
    }

    public static <S, T> PageResponse<T> toPageResponse(PageInfo<S> pageInfo, Function<S, T> mapper) {
        List<T> list = pageInfo.getList().stream()
                .map(mapper)
                .toList();
        return PageResponse.<T>builder()
                .list(list)
                .total(pageInfo.getTotal())
                .pageNum(pageInfo.getPageNum())
                .pageSize(pageInfo.getPageSize())
                .pages(pageInfo.getPages())
                .hasNextPage(pageInfo.isHasNextPage())
                .hasPreviousPage(pageInfo.isHasPreviousPage())
                .build();
    }
}
