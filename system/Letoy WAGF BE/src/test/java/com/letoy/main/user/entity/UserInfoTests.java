package com.letoy.main.user.entity;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserInfoTests {

    @Test
    void shouldSplitGroupIdsIntoNormalizedList() {
        UserInfo userInfo = UserInfo.builder()
                .groupIds("ROOT, G1 , ,G2")
                .build();

        assertEquals(List.of("ROOT", "G1", "G2"), userInfo.getGroupIdList());
    }

    @Test
    void shouldReturnEmptyRoleListWhenRolesBlank() {
        UserInfo userInfo = UserInfo.builder()
                .roles(" ")
                .build();

        assertTrue(userInfo.getRoleList().isEmpty());
    }
}
