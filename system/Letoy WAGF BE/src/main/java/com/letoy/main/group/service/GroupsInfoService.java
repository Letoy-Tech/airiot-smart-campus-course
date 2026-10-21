package com.letoy.main.group.service;

import com.github.pagehelper.PageInfo;
import com.letoy.main.group.entity.GroupsInfo;

import java.util.List;

public interface GroupsInfoService {

    /** 新增根部门（parentGroupId 为空） */
    int createRoot(GroupsInfo root);

    /** 新增子部门（会自动计算 path/level） */
    int createChild(GroupsInfo child);

    /**
     * 更新部门信息（按 groupIds）
     * - 若 parentGroupId 发生变化：自动重算本节点 path/level，并递归更新所有后代节点
     * - 若 parent 未变：仅更新常规字段
     */
    int updateByGroupIdWithAutoMove(GroupsInfo toUpdate);

    GroupsInfo getById(Long id);

    GroupsInfo getByGroupId(String groupIds);

    List<GroupsInfo> getByGroupIds(List<String> groupIds);

    List<GroupsInfo> listChildren(String parentGroupId);

    /** 查询某根节点整棵子树（含自身） */
    List<GroupsInfo> listSubtree(String rootGroupId);
    List<GroupsInfo> getAllGroups();

    /** 删除节点（不处理子孙，若需要连带删除可另行封装） */
    int deleteByGroupId(String groupIds);

    /** 判断编码是否存在 */
    boolean exists(String groupIds);

    PageInfo<GroupsInfo> pageByCondition(Integer currentPage, Integer pageSize,
                                         String groupName, String parentGroupId);
}
