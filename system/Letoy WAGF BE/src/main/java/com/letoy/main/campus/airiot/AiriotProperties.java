package com.letoy.main.campus.airiot;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "campus.airiot")
public class AiriotProperties {
    public static final String PROJECT_ID = "000000000000000000000001";

    private String baseUrl = "";
    private String projectId = PROJECT_ID;
    private String appKey = "";
    private String appSecret = "";
    private boolean controlEnabled;
    private int timeoutSeconds = 8;
    private int pageSize = 100;
    private int maxPages = 100;
    private int maxHistorySpanHours = 168;

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String value) { baseUrl = value; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String value) { projectId = value; }
    public String getAppKey() { return appKey; }
    public void setAppKey(String value) { appKey = value; }
    public String getAppSecret() { return appSecret; }
    public void setAppSecret(String value) { appSecret = value; }
    public boolean isControlEnabled() { return controlEnabled; }
    public void setControlEnabled(boolean value) { controlEnabled = value; }
    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int value) { timeoutSeconds = value; }
    public int getPageSize() { return pageSize; }
    public void setPageSize(int value) { pageSize = value; }
    public int getMaxPages() { return maxPages; }
    public void setMaxPages(int value) { maxPages = value; }
    public int getMaxHistorySpanHours() { return maxHistorySpanHours; }
    public void setMaxHistorySpanHours(int value) { maxHistorySpanHours = value; }

    @Override
    public String toString() {
        return "AiriotProperties{credentials=[REDACTED], controlEnabled=" + controlEnabled + "}";
    }
}
