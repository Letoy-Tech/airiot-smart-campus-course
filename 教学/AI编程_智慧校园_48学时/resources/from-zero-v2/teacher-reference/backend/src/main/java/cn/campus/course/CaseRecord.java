package cn.campus.course;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class CaseRecord {
    public String id;
    public String deviceId;
    public String message;
    public String state;
    public String assignee;
    public String sourceState;
    public boolean verified;
    public String note;
    public String conclusion;
    public long version;
    public List<Map<String, Object>> timeline = new ArrayList<>();
}
