// 会话与“最后一次请求”守卫（第11课失败处理统一）：
// 1) 会话代次只在登录、退出、会话过期或切换数据方式时变化；
// 2) 同一页只接受最后一次请求的结果。
// 两者一起用：切换设备/账号后，较早发出的请求即使后返回，也不能覆盖新选择。

export function createSessionGuard() {
  let generation = 0;

  return {
    generation() {
      return generation;
    },
    invalidate() {
      generation += 1;
    },
  };
}

export function createLatestRequest() {
  let latest = 0;

  return {
    begin() {
      latest += 1;
      return latest;
    },
    isLatest(token) {
      return token === latest;
    },
    invalidate() {
      latest += 1;
    },
  };
}
