package com.letoy.main.auth.mapper;

import com.letoy.main.auth.entity.RefreshToken;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Date;
import java.util.List;

/**
 * Refresh Token Mapper 接口
 *
 * <p>数据访问层：refresh_token 表操作
 *
 * <p><strong>Phase 1: JWT 体系升级</strong> - Refresh Token 数据访问
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 1)
 */
@Mapper
public interface RefreshTokenMapper {

    /**
     * 创建 Refresh Token 记录
     *
     * @param refreshToken Refresh Token 实体
     * @return 影响行数
     */
    int insert(RefreshToken refreshToken);

    /**
     * 根据 Refresh Token 字符串查询
     *
     * @param refreshToken Refresh Token 字符串
     * @return Refresh Token 实体
     */
    RefreshToken findByToken(@Param("refreshToken") String refreshToken);

    /**
     * 根据用户ID查询所有有效的 Refresh Token
     *
     * @param uid 用户ID
     * @return Refresh Token 列表
     */
    List<RefreshToken> findValidByUid(@Param("uid") String uid);

    /**
     * 根据用户ID查询所有 Refresh Token（包括已撤销）
     *
     * @param uid 用户ID
     * @return Refresh Token 列表
     */
    List<RefreshToken> findAllByUid(@Param("uid") String uid);

    /**
     * 更新最后使用时间
     *
     * @param id Refresh Token ID
     * @param lastUsedAt 最后使用时间
     * @return 影响行数
     */
    int updateLastUsedAt(@Param("id") Long id, @Param("lastUsedAt") Date lastUsedAt);

    /**
     * 撤销单个 Refresh Token
     *
     * @param id Refresh Token ID
     * @param revokeReason 撤销原因
     * @return 影响行数
     */
    int revokeById(@Param("id") Long id, @Param("revokeReason") String revokeReason);

    /**
     * 撤销用户的所有 Refresh Token
     *
     * @param uid 用户ID
     * @param revokeReason 撤销原因
     * @return 影响行数
     */
    int revokeAllByUid(@Param("uid") String uid, @Param("revokeReason") String revokeReason);

    /**
     * 删除过期的 Refresh Token
     *
     * @return 删除行数
     */
    int deleteExpired();

    /**
     * 删除已撤销超过指定天数的 Refresh Token
     *
     * @param days 天数
     * @return 删除行数
     */
    int deleteRevokedOlderThan(@Param("days") int days);

    /**
     * 统计用户当前有效的 Refresh Token 数量
     *
     * @param uid 用户ID
     * @return 数量
     */
    int countValidByUid(@Param("uid") String uid);
}
