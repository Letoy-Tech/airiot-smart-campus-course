package edu.campus.v2.owner;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;

/**
 * 一行 owners 记录 → Owner。只做取值与类型转换，不含 SQL 与业务判断。
 */
public class OwnerRowMapper implements RowMapper<Owner> {

    @Override
    public Owner mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new Owner(
                rs.getString("device_id"),
                rs.getString("username"),
                rs.getString("note"),
                rs.getInt("version"));
    }
}
