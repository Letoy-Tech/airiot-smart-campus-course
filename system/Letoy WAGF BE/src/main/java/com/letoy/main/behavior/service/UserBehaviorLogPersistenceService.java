package com.letoy.main.behavior.service;

import com.letoy.main.behavior.entity.UserBehaviorLog;
import com.letoy.main.behavior.mapper.UserBehaviorLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserBehaviorLogPersistenceService {

    private final UserBehaviorLogMapper userBehaviorLogMapper;

    public void persist(UserBehaviorLog log) {
        userBehaviorLogMapper.insertIgnore(log);
    }
}
