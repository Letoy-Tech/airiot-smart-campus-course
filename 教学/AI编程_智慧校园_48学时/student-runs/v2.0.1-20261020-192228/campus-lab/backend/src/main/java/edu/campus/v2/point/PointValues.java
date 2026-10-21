package edu.campus.v2.point;

/**
 * 读数列的类型转换：把驱动的返回值转成 Double / Long。
 * 唯一的规矩：SQL NULL 一律返回 null，绝不改成 0；
 * 0 在读数里是"有效读到 0"，和"没有读数"必须区分。
 */
public final class PointValues {

    private PointValues() {
    }

    /** DECIMAL 在驱动里可能是 BigDecimal 或其他 Number；NULL 保持 null。 */
    public static Double toDouble(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number value) {
            return value.doubleValue();
        }
        String text = raw.toString().trim();
        return text.isEmpty() ? null : Double.valueOf(text);
    }

    /** BIGINT 在驱动里可能是 Long 或 BigDecimal；NULL 保持 null。 */
    public static Long toLong(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number value) {
            return value.longValue();
        }
        String text = raw.toString().trim();
        return text.isEmpty() ? null : Long.valueOf(text);
    }
}
