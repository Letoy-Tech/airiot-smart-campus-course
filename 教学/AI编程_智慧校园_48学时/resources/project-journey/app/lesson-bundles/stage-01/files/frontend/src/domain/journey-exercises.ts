/** 学生长期保留的业务小函数；后续导入不覆盖此文件。 */
export function communicationLabel(value: boolean | null): string {
  if (value === true) return '在线'
  if (value === false) return '离线'
  return '未知'
}
