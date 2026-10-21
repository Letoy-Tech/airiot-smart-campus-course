package com.letoy.main.group.mapper;

import com.letoy.main.group.entity.GroupsInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface GroupsInfoMapper {

    /** 直接插入（当外部已计算好 path/level 时使用） */
    int insert(GroupsInfo record);

    /**
     * 作为某父部门的子部门插入：自动计算 path 与 level
     * - 必填：groupIds, groupName
     * - 可选：groupDescription, parentGroupId, sortOrder, status
     */
    int insertChild(GroupsInfo record);

    /** 根据 groupIds 动态更新（不更新 id、groupIds、createTime） */
    int updateByGroupId(GroupsInfo record);

    /** 主键与编码查询 */
    GroupsInfo selectById(@Param("id") Long id);
    GroupsInfo selectByGroupId(@Param("groupId") String groupId);
    List<GroupsInfo> selectByGroupIds(@Param("groupIds") List<String> groupIds);

    /** 直属下级列表 */
    List<GroupsInfo> selectChildren(@Param("parentGroupId") String parentGroupId);

    /** 子树（含自身） */
    List<GroupsInfo> selectSubtreeByRoot(@Param("rootGroupId") String rootGroupId);

    /** 存在性检查（返回匹配数量） */
    Integer existsByGroupId(@Param("groupId") String groupId);

    /** 删除 */
    int deleteByGroupId(@Param("groupId") String groupId);

    List<GroupsInfo> selectByCondition(@Param("groupName") String groupName,
                                       @Param("parentGroupId") String parentGroupId);

    List<GroupsInfo> getAllGroups();
}
