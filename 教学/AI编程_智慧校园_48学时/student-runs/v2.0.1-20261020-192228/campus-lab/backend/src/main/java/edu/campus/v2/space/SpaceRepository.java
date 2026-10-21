package edu.campus.v2.space;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * spaces 表的查询入口：只放 SQL 与行映射，不处理 HTTP、不做业务判断。
 */
@Repository
public class SpaceRepository {

    private static final String SELECT_ALL_ORDER_BY_ID = """
            SELECT id, name, building, `floor`
            FROM spaces
            ORDER BY id""";

    private static final String SELECT_BY_ID = """
            SELECT id, name, building, `floor`
            FROM spaces
            WHERE id = ?""";

    // 只改楼栋与楼层；id、name 不参与更新，设备归属由 devices.space_id 决定，不在这里改。
    private static final String UPDATE_LOCATION = """
            UPDATE spaces
            SET building = ?, `floor` = ?
            WHERE id = ?""";

    private final JdbcTemplate jdbcTemplate;

    public SpaceRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Space> findAllOrderById() {
        return jdbcTemplate.query(SELECT_ALL_ORDER_BY_ID, new SpaceRowMapper());
    }

    public Optional<Space> findById(String id) {
        return jdbcTemplate.query(SELECT_BY_ID, new SpaceRowMapper(), id).stream().findFirst();
    }

    /** 参数按占位符绑定，不拼接 SQL；返回受影响行数，0 表示该 id 不存在。 */
    public int updateLocation(String id, String building, String floor) {
        return jdbcTemplate.update(UPDATE_LOCATION, building, floor, id);
    }
}
