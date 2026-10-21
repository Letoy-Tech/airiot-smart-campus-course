package com.letoy.main.behavior.mapper;

import com.letoy.main.behavior.entity.UserBehaviorLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserBehaviorLogMapper {

    int insertIgnore(UserBehaviorLog log);
}
