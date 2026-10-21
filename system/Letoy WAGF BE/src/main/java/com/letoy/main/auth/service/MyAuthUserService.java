package com.letoy.main.auth.service;

import com.letoy.main.auth.entity.AuthUser;
import org.springframework.security.core.userdetails.UserDetailsService;

public interface MyAuthUserService extends UserDetailsService {
    AuthUser getUserByUserId(String userId);
}
