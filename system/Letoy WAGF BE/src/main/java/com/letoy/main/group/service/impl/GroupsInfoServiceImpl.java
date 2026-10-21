package com.letoy.main.group.service.impl;


import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import com.letoy.main.group.mapper.GroupsInfoMapper;
import com.letoy.main.group.entity.GroupsInfo;
import com.letoy.main.group.service.GroupsInfoService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupsInfoServiceImpl implements GroupsInfoService {

    private final GroupsInfoMapper groupsInfoMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int createRoot(GroupsInfo root) {
        if (!StringUtils.hasText(root.getGroupId())) {
            throw new IllegalArgumentException("groupIds 不能为空");
        }
        if (!StringUtils.hasText(root.getGroupName())) {
            throw new IllegalArgumentException("groupName 不能为空");
        }
        if (exists(root.getGroupId())) {
            throw new IllegalArgumentException("groupIds 已存在: " + root.getGroupId());
        }
        // 根：parent=null，insertChild 会生成 level=0、path='/' + gid + '/'
        root.setParentGroupId(null);
        return groupsInfoMapper.insertChild(root);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int createChild(GroupsInfo child) {
        if (!StringUtils.hasText(child.getGroupId())) {
            throw new IllegalArgumentException("groupIds 不能为空");
        }
        if (!StringUtils.hasText(child.getGroupName())) {
            throw new IllegalArgumentException("groupName 不能为空");
        }
        if (!StringUtils.hasText(child.getParentGroupId())) {
            // 若未传父级，按根处理
            return createRoot(child);
        }
        if (exists(child.getGroupId())) {
            throw new IllegalArgumentException("groupIds 已存在: " + child.getGroupId());
        }
        // 由 XML 的 insertChild 计算 path/level
        return groupsInfoMapper.insertChild(child);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int updateByGroupIdWithAutoMove(GroupsInfo toUpdate) {
        if (!StringUtils.hasText(toUpdate.getGroupId())) {
            throw new IllegalArgumentException("GroupId 不能为空");
        }
        GroupsInfo origin = groupsInfoMapper.selectByGroupId(toUpdate.getGroupId());
        if (origin == null) {
            throw new IllegalArgumentException("未找到 groupIds=" + toUpdate.getGroupId());
        }

        // 判断是否更换父级（null 与 空视为同义）
        String newParent = normalize(toUpdate.getParentGroupId());
        String oldParent = normalize(origin.getParentGroupId());
        boolean parentChanged = !Objects.equals(newParent, oldParent);

        if (!parentChanged) {
            // 普通更新（不动层级）
            // 直接走 mapper 动态 <set>
            return groupsInfoMapper.updateByGroupId(toUpdate);
        }

        // ===== 父级发生变化：需要“移动节点” =====
        // 1) 取新父节点（可为 null，表示挂到根）
        GroupsInfo newParentInfo = null;
        if (StringUtils.hasText(newParent)) {
            newParentInfo = groupsInfoMapper.selectByGroupId(newParent);
            if (newParentInfo == null) {
                throw new IllegalArgumentException("新的父级不存在: " + newParent);
            }
            // 防止挂到自己的子树上（形成环）
            List<GroupsInfo> selfTree = groupsInfoMapper.selectSubtreeByRoot(origin.getGroupId());
            boolean isDescendant = selfTree.stream()
                    .anyMatch(n -> n.getGroupId().equals(newParent));
            if (isDescendant) {
                throw new IllegalStateException("不能将节点移动到自己的子树下面（会形成环）");
            }
        }

        // 2) 计算本节点新 path/level
        String newParentPath = (newParentInfo == null) ? "/" : newParentInfo.getPath();
        Integer newParentLevel = (newParentInfo == null) ? -1 : newParentInfo.getLevel();
        String newPath = GroupsInfo.buildPath(newParentPath, origin.getGroupId());
        int newLevel = (newParentLevel == null ? -1 : newParentLevel) + 1;

        // 3) 更新本节点
        GroupsInfo selfUpdate = new GroupsInfo();
        selfUpdate.setGroupId(origin.getGroupId());
        selfUpdate.setParentGroupId(newParent); // 允许为 null
        selfUpdate.setPath(newPath);
        selfUpdate.setLevel(newLevel);
        // 其它可更新字段沿用 toUpdate 的非空值
        selfUpdate.setGroupName(defaultIfNull(toUpdate.getGroupName(), origin.getGroupName()));
        selfUpdate.setGroupDescription(defaultIfNull(toUpdate.getGroupDescription(), origin.getGroupDescription()));
        selfUpdate.setSortOrder(defaultIfNull(toUpdate.getSortOrder(), origin.getSortOrder()));
        selfUpdate.setStatus(defaultIfNull(toUpdate.getStatus(), origin.getStatus()));
        groupsInfoMapper.updateByGroupId(selfUpdate);

        // 4) 批量更新所有后代节点：逐个重算 path/level
        List<GroupsInfo> subtree = groupsInfoMapper.selectSubtreeByRoot(origin.getGroupId());
        // 按 path 长度从短到长，确保父在先、子在后
        subtree = subtree.stream()
                .filter(n -> !n.getGroupId().equals(origin.getGroupId())) // 排除根（已更新）
                .sorted(Comparator.comparingInt(n -> n.getPath() == null ? 0 : n.getPath().length()))
                .collect(Collectors.toList());

        for (GroupsInfo node : subtree) {
            // 取新父（已在前面更新过父链）
            GroupsInfo parent = groupsInfoMapper.selectByGroupId(node.getParentGroupId());
            String pPath = (parent == null || !StringUtils.hasText(parent.getPath())) ? "/" : parent.getPath();
            int pLevel = (parent == null || parent.getLevel() == null) ? -1 : parent.getLevel();

            GroupsInfo upd = new GroupsInfo();
            upd.setGroupId(node.getGroupId());
            upd.setPath(GroupsInfo.buildPath(pPath, node.getGroupId()));
            upd.setLevel(pLevel + 1);
            groupsInfoMapper.updateByGroupId(upd);
        }

        return 1;
    }

    @Override
    public GroupsInfo getById(Long id) {
        return groupsInfoMapper.selectById(id);
    }

    @Override
    public GroupsInfo getByGroupId(String groupId) {
        return groupsInfoMapper.selectByGroupId(groupId);
    }

    @Override
    public List<GroupsInfo> getByGroupIds(List<String> groupIds) {
        if (groupIds == null || groupIds.isEmpty()) {
            return List.of();
        }
        return groupsInfoMapper.selectByGroupIds(groupIds);
    }

    @Override
    public List<GroupsInfo> listChildren(String parentGroupId) {
        return groupsInfoMapper.selectChildren(parentGroupId);
    }

    @Override
    public List<GroupsInfo> listSubtree(String rootGroupsId) {
        return groupsInfoMapper.selectSubtreeByRoot(rootGroupsId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int deleteByGroupId(String groupId) {
        return groupsInfoMapper.deleteByGroupId(groupId);
    }

    @Override
    public boolean exists(String groupIds) {
        Integer cnt = groupsInfoMapper.existsByGroupId(groupIds);
        return cnt != null && cnt > 0;
    }

    @Override
    public PageInfo<GroupsInfo> pageByCondition(Integer currentPage, Integer pageSize,
                                                String groupName, String parentGroupId) {
        int pageNum  = (currentPage == null || currentPage < 1) ? 1  : currentPage;
        int pageSizeSafe = (pageSize == null || pageSize < 1) ? 10 : pageSize;
        PageHelper.startPage(pageNum, pageSizeSafe);
        List<GroupsInfo> list = groupsInfoMapper.selectByCondition(groupName, parentGroupId);
        return PageInfo.of(list);
    }

    @Override
    public List<GroupsInfo> getAllGroups() {
        return groupsInfoMapper.getAllGroups();
    }

    // ===== helpers =====
    private static String normalize(String s) {
        return StringUtils.hasText(s) ? s.trim() : null;
    }
    private static <T> T defaultIfNull(T v, T fallback) {
        return v != null ? v : fallback;
    }
}
