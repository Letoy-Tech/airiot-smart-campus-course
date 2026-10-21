package edu.campus.v2.history;

/**
 * 一个历史样本（对外返回结构）：time 为样本原始时间（epoch 毫秒）。
 * value 为 Double：NULL 表示该时刻没有读数，0 表示有效读到 0，两者都必须原样保留。
 */
public record HistorySample(long time, Double value) {
}
