package com.letoy.main.permission.mapper;

import com.letoy.main.permission.entity.ApiRule;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.springframework.stereotype.Component;

import java.util.List;

@Mapper
@Component
public interface ApiRuleMapper {
    ApiRule getById(Long id);
    List<ApiRule> getByIdList(@Param("idList") List<Long> idList);
    List<ApiRule> getAllEnabled();
    List<ApiRule> getAll();
    List<ApiRule> queryWithFilter(@Param("name") String name,
                                   @Param("pattern") String pattern,
                                   @Param("methods") String methods,
                                   @Param("groupPolicy") String groupPolicy,
                                   @Param("enabled") Boolean enabled);
    int insert(ApiRule rule);
    int updateById(ApiRule rule);
    int deleteById(Long id);
}