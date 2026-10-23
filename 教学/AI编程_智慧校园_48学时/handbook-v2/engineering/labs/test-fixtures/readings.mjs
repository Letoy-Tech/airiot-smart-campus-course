// 故意失败的独立教学样本：请勿导入课程业务工程。
// 合同：null => 缺失；有限数保留数值（包括0）；其他值拒绝。
export function formatReading(value, unit = 'kW') {
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
        throw new TypeError('reading must be a finite number or null');
    }
    if (typeof unit !== 'string') {
        throw new TypeError('unit must be a string');
    }
    // 这里刻意留下一个真假判断错误，供学生定位和最小修复。
    if (!value) return '缺失';
    return unit ? `${value} ${unit}` : String(value);
}
