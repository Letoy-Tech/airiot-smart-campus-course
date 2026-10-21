package com.letoy.main.common.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisStringCommands;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Component;

import jakarta.annotation.Resource;
import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Component
public final class RedisUtil {

    private static final Logger logger = LoggerFactory.getLogger(RedisUtil.class);

    @Value("${template.app-name}")
    private String appName;


    @Resource
    @Qualifier("myRedisTemplate")
    private RedisTemplate<String, Object> myRedisTemplate;

    // =============================common============================

    /**
     * 获取带前缀的键
     *
     * @param key 原始键
     * @return 带前缀的键
     */
    private String getPrefixedKey(String key) {
        return appName + "-" + key;
    }

    /**
     * 指定缓存失效时间
     *
     * @param key  键
     * @param time 时间(秒)
     * @return 是否成功
     */
    public boolean expire(String key, long time) {
        try {
            if (time > 0) {
                myRedisTemplate.expire(getPrefixedKey(key), time, TimeUnit.SECONDS);
            }
            return true;
        } catch (Exception e) {
            logger.error("设置过期时间失败，key: {}", key, e);
            return false;
        }
    }

    /**
     * 指定缓存失效时间并设置值
     *
     * @param key   键
     * @param value 值
     * @param time  时间(秒)
     * @return 是否成功
     */
    public boolean expire(String key, Object value, long time) {
        try {
            if (time > 0) {
                myRedisTemplate.opsForValue().set(getPrefixedKey(key), value, time, TimeUnit.SECONDS);
            }
            return true;
        } catch (Exception e) {
            logger.error("设置键值及过期时间失败，key: {}", key, e);
            return false;
        }
    }

    /**
     * 获取所有匹配的键
     *
     * @param pattern 匹配模式
     * @return 匹配的键集合
     */
    public Set<String> keys(String pattern) {
        try {
            return myRedisTemplate.keys(pattern);
        } catch (Exception e) {
            logger.error("获取匹配键失败，pattern: {}", pattern, e);
            return Collections.emptySet();
        }
    }

    /**
     * 递减指定键的值
     *
     * @param key        键
     * @param decrement 减少的数值
     * @return 递减后的值
     */
    public Long decrBy(String key, long decrement) {
        try {
            return myRedisTemplate.opsForValue().decrement(getPrefixedKey(key), decrement);
        } catch (Exception e) {
            logger.error("递减键值失败，key: {}", key, e);
            return null;
        }
    }

    /**
     * 递增指定键的值
     *
     * @param key       键
     * @param increment 增加的数值
     * @return 递增后的值
     */
    public Long incrBy(String key, long increment) {
        try {
            return myRedisTemplate.opsForValue().increment(getPrefixedKey(key), increment);
        } catch (Exception e) {
            logger.error("递增键值失败，key: {}", key, e);
            return null;
        }
    }

    /**
     * 使用现有TTL设置键值
     *
     * @param key   键（Serializable）
     * @param value 值
     * @return 是否成功
     */
    public boolean setWithKeepTtl(Serializable key, Object value) {
        try (ByteArrayOutputStream bosKey = new ByteArrayOutputStream();
             ObjectOutputStream oosKey = new ObjectOutputStream(bosKey)) {
            oosKey.writeObject(key);
            byte[] keyBytes = bosKey.toByteArray();

            byte[] valueBytes = String.valueOf(value).getBytes(StandardCharsets.UTF_8);

            return myRedisTemplate.execute((RedisCallback<Boolean>) connection -> {
                connection.set(keyBytes, valueBytes, Expiration.keepTtl(), RedisStringCommands.SetOption.UPSERT);
                return true;
            });
        } catch (Exception e) {
            logger.error("设置键值并保持TTL失败，key: {}", key, e);
            return false;
        }
    }

    /**
     * 根据键获取过期时间
     *
     * @param key 键
     * @return 过期时间（秒），返回0代表永久有效
     */
    public long getExpire(String key) {
        try {
            return myRedisTemplate.getExpire(getPrefixedKey(key), TimeUnit.SECONDS);
        } catch (Exception e) {
            logger.error("获取过期时间失败，key: {}", key, e);
            return -1;
        }
    }

    /**
     * 判断键是否存在
     *
     * @param key 键
     * @return 是否存在
     */
    public boolean hasKey(String key) {
        try {
            return myRedisTemplate.hasKey(getPrefixedKey(key));
        } catch (Exception e) {
            logger.error("检查键是否存在失败，key: {}", key, e);
            return false;
        }
    }

    /**
     * 删除缓存
     *
     * @param keys 可以传一个值 或多个
     */
    @SuppressWarnings("unchecked")
    public void del(String... keys) {
        if (keys != null && keys.length > 0) {
            try {
                if (keys.length == 1) {
                    myRedisTemplate.delete(getPrefixedKey(keys[0]));
                } else {
                    Collection<String> prefixedKeys = Arrays.stream(keys)
                            .map(this::getPrefixedKey)
                            .collect(Collectors.toList());
                    myRedisTemplate.delete(prefixedKeys);
                }
            } catch (Exception e) {
                logger.error("删除键失败，keys: {}", Arrays.toString(keys), e);
            }
        }
    }

    // ============================String=============================

    /**
     * 普通缓存获取
     *
     * @param key 键
     * @return 值
     */
    public Object get(String key) {
        try {
            return myRedisTemplate.opsForValue().get(getPrefixedKey(key));
        } catch (Exception e) {
            logger.error("获取键值失败，key: {}", key, e);
            return null;
        }
    }

    /**
     * 普通缓存放入
     *
     * @param key   键
     * @param value 值
     * @return 是否成功
     */
    public boolean set(String key, Object value) {
        try {
            myRedisTemplate.opsForValue().set(getPrefixedKey(key), value);
            return true;
        } catch (Exception e) {
            logger.error("设置键值失败，key: {}", key, e);
            return false;
        }
    }

    public boolean setSValue(String key, String value) {
        try {
            myRedisTemplate.opsForValue().set(getPrefixedKey(key), value);
            return true;
        } catch (Exception e) {
            logger.error("设置键值失败，key: {}", key, e);
            return false;
        }
    }


    /**
     * 普通缓存放入并设置时间
     *
     * @param key   键
     * @param value 值
     * @param time  时间(秒) time要大于0 如果time小于等于0 将设置无限期
     * @return 是否成功
     */
    public boolean set(String key, Object value, long time) {
        try {
            String prefixedKey = getPrefixedKey(key);
            if (time > 0) {
                myRedisTemplate.opsForValue().set(prefixedKey, value, time, TimeUnit.SECONDS);
            } else {
                myRedisTemplate.opsForValue().set(prefixedKey, value);
            }
            return true;
        } catch (Exception e) {
            logger.error("设置键值及过期时间失败，key: {}", key, e);
            return false;
        }
    }

    /**
     * 递增
     *
     * @param key   键
     * @param delta 要增加几(大于0)
     * @return 递增后的值
     */
    public long incr(String key, long delta) {
        if (delta < 0) {
            throw new RuntimeException("递增因子必须大于0");
        }
        try {
            return myRedisTemplate.opsForValue().increment(getPrefixedKey(key), delta);
        } catch (Exception e) {
            logger.error("递增键值失败，key: {}", key, e);
            return 0;
        }
    }

    /**
     * 递减
     *
     * @param key   键
     * @param delta 要减少几(大于0)
     * @return 递减后的值
     */
    public long decr(String key, long delta) {
        if (delta < 0) {
            throw new RuntimeException("递减因子必须大于0");
        }
        try {
            return myRedisTemplate.opsForValue().increment(getPrefixedKey(key), -delta);
        } catch (Exception e) {
            logger.error("递减键值失败，key: {}", key, e);
            return 0;
        }
    }

    // ================================Map=================================

    /**
     * HashGet
     *
     * @param key  键 不能为null
     * @param item 项 不能为null
     * @return 对应的值
     */
    public Object hget(String key, String item) {
        try {
            return myRedisTemplate.opsForHash().get(getPrefixedKey(key), item);
        } catch (Exception e) {
            logger.error("Hash获取失败，key: {}, item: {}", key, item, e);
            return null;
        }
    }

    /**
     * 获取hashKey对应的所有键值
     *
     * @param key 键
     * @return 对应的多个键值
     */
    public Map<Object, Object> hmget(String key) {
        try {
            return myRedisTemplate.opsForHash().entries(getPrefixedKey(key));
        } catch (Exception e) {
            logger.error("Hash获取所有键值失败，key: {}", key, e);
            return Collections.emptyMap();
        }
    }

    /**
     * HashSet
     *
     * @param key 键
     * @param map 对应多个键值
     * @return 是否成功
     */
    public boolean hmset(String key, Map<String, Object> map) {
        try {
            myRedisTemplate.opsForHash().putAll(getPrefixedKey(key), map);
            return true;
        } catch (Exception e) {
            logger.error("Hash设置多个键值失败，key: {}", key, e);
            return false;
        }
    }

    /**
     * HashSet 并设置时间
     *
     * @param key  键
     * @param map  对应多个键值
     * @param time 时间(秒)
     * @return 是否成功
     */
    public boolean hmset(String key, Map<String, Object> map, long time) {
        try {
            myRedisTemplate.opsForHash().putAll(getPrefixedKey(key), map);
            if (time > 0) {
                expire(key, time);
            }
            return true;
        } catch (Exception e) {
            logger.error("Hash设置多个键值及过期时间失败，key: {}", key, e);
            return false;
        }
    }

    /**
     * 向一张hash表中放入数据,如果不存在将创建
     *
     * @param key   键
     * @param item  项
     * @param value 值
     * @return 是否成功
     */
    public boolean hset(String key, String item, Object value) {
        try {
            myRedisTemplate.opsForHash().put(getPrefixedKey(key), item, value);
            return true;
        } catch (Exception e) {
            logger.error("Hash设置键值失败，key: {}, item: {}", key, item, e);
            return false;
        }
    }

    /**
     * 向一张hash表中放入数据,如果不存在将创建
     *
     * @param key   键
     * @param item  项
     * @param value 值
     * @param time  时间(秒) 注意:如果已存在的hash表有时间,这里将会替换原有的时间
     * @return 是否成功
     */
    public boolean hset(String key, String item, Object value, long time) {
        try {
            myRedisTemplate.opsForHash().put(getPrefixedKey(key), item, value);
            if (time > 0) {
                expire(key, time);
            }
            return true;
        } catch (Exception e) {
            logger.error("Hash设置键值及过期时间失败，key: {}, item: {}", key, item, e);
            return false;
        }
    }

    /**
     * 删除hash表中的值
     *
     * @param key  键 不能为null
     * @param item 项 可以是多个 不能为null
     */
    public void hdel(String key, Object... item) {
        try {
            myRedisTemplate.opsForHash().delete(getPrefixedKey(key), item);
        } catch (Exception e) {
            logger.error("Hash删除键值失败，key: {}, items: {}", key, Arrays.toString(item), e);
        }
    }

    /**
     * 判断hash表中是否有该项的值
     *
     * @param key  键 不能为null
     * @param item 项 不能为null
     * @return 是否存在
     */
    public boolean hHasKey(String key, String item) {
        try {
            return myRedisTemplate.opsForHash().hasKey(getPrefixedKey(key), item);
        } catch (Exception e) {
            logger.error("Hash检查键是否存在失败，key: {}, item: {}", key, item, e);
            return false;
        }
    }

    /**
     * hash递增 如果不存在,就会创建一个 并把新增后的值返回
     *
     * @param key  键
     * @param item 项
     * @param by   要增加几(大于0)
     * @return 增加后的值
     */
    public double hincr(String key, String item, double by) {
        try {
            return myRedisTemplate.opsForHash().increment(getPrefixedKey(key), item, by);
        } catch (Exception e) {
            logger.error("Hash递增失败，key: {}, item: {}, by: {}", key, item, by, e);
            return 0;
        }
    }

    /**
     * hash递减
     *
     * @param key  键
     * @param item 项
     * @param by   要减少几(大于0)
     * @return 减少后的值
     */
    public double hdecr(String key, String item, double by) {
        try {
            return myRedisTemplate.opsForHash().increment(getPrefixedKey(key), item, -by);
        } catch (Exception e) {
            logger.error("Hash递减失败，key: {}, item: {}, by: {}", key, item, by, e);
            return 0;
        }
    }

    // ============================set=============================

    /**
     * 根据key获取Set中的所有值
     *
     * @param key 键
     * @return Set中的所有值
     */
    public Set<Object> sGet(String key) {
        try {
            return myRedisTemplate.opsForSet().members(getPrefixedKey(key));
        } catch (Exception e) {
            logger.error("获取Set中的所有值失败，key: {}", key, e);
            return Collections.emptySet();
        }
    }

    /**
     * SMEMBERS：获取 Set 中的所有成员（与 sGet 等价，做方法名兼容）
     *
     * @param key 键
     * @return 成员集合
     */
    public Set<Object> sMembers(String key) {
        try {
            return myRedisTemplate.opsForSet().members(getPrefixedKey(key));
        } catch (Exception e) {
            logger.error("获取Set成员失败，key: {}", key, e);
            return Collections.emptySet();
        }
    }

    /**
     * SMEMBERS（String 版本）：将成员转成 String 返回，便于 JSON 解析等场景
     *
     * @param key 键
     * @return 成员字符串集合
     */
    public Set<String> sMembersAsString(String key) {
        Set<Object> raw = sMembers(key);
        if (raw == null || raw.isEmpty()) return Collections.emptySet();
        Set<String> out = new HashSet<>(raw.size());
        for (Object o : raw) out.add(String.valueOf(o));
        return out;
    }

    /**
     * 根据value从一个set中查询,是否存在
     *
     * @param key   键
     * @param value 值
     * @return 是否存在
     */
    public boolean sHasKey(String key, Object value) {
        try {
            return myRedisTemplate.opsForSet().isMember(getPrefixedKey(key), value);
        } catch (Exception e) {
            logger.error("Set中检查值是否存在失败，key: {}, value: {}", key, value, e);
            return false;
        }
    }

    /**
     * 将数据放入set缓存
     *
     * @param key    键
     * @param values 值 可以是多个
     * @return 成功个数
     */
    public long sSet(String key, Object... values) {
        try {
            return myRedisTemplate.opsForSet().add(getPrefixedKey(key), values);
        } catch (Exception e) {
            logger.error("将值添加到Set失败，key: {}, values: {}", key, Arrays.toString(values), e);
            return 0;
        }
    }

    /**
     * 将set数据放入缓存并设置时间
     *
     * @param key    键
     * @param time   时间(秒)
     * @param values 值 可以是多个
     * @return 成功个数
     */
    public long sSetAndTime(String key, long time, Object... values) {
        try {
            Long count = myRedisTemplate.opsForSet().add(getPrefixedKey(key), values);
            if (time > 0)
                expire(key, time);
            return count != null ? count : 0;
        } catch (Exception e) {
            logger.error("将值添加到Set并设置过期时间失败，key: {}, values: {}", key, Arrays.toString(values), e);
            return 0;
        }
    }

    /**
     * 获取set缓存的长度
     *
     * @param key 键
     * @return set的大小
     */
    public long sGetSetSize(String key) {
        try {
            Long size = myRedisTemplate.opsForSet().size(getPrefixedKey(key));
            return size != null ? size : 0;
        } catch (Exception e) {
            logger.error("获取Set大小失败，key: {}", key, e);
            return 0;
        }
    }

    /**
     * 移除值为value的
     *
     * @param key    键
     * @param values 值 可以是多个
     * @return 移除的个数
     */
    public long setRemove(String key, Object... values) {
        try {
            Long count = myRedisTemplate.opsForSet().remove(getPrefixedKey(key), values);
            return count != null ? count : 0;
        } catch (Exception e) {
            logger.error("从Set中移除值失败，key: {}, values: {}", key, Arrays.toString(values), e);
            return 0;
        }
    }

    // ===============================list=================================

    /**
     * 获取list缓存的内容
     *
     * @param key   键
     * @param start 开始
     * @param end   结束 0 到 -1代表所有值
     * @return list中的值
     */
    public List<Object> lGet(String key, long start, long end) {
        try {
            return myRedisTemplate.opsForList().range(getPrefixedKey(key), start, end);
        } catch (Exception e) {
            logger.error("获取List中的值失败，key: {}, start: {}, end: {}", key, start, end, e);
            return Collections.emptyList();
        }
    }

    /**
     * 获取list缓存的长度
     *
     * @param key 键
     * @return list的长度
     */
    public long lGetListSize(String key) {
        try {
            Long size = myRedisTemplate.opsForList().size(getPrefixedKey(key));
            return size != null ? size : 0;
        } catch (Exception e) {
            logger.error("获取List大小失败，key: {}", key, e);
            return 0;
        }
    }

    /**
     * 通过索引获取list中的值
     *
     * @param key   键
     * @param index 索引
     * @return list中的值
     */
    public Object lGetIndex(String key, long index) {
        try {
            return myRedisTemplate.opsForList().index(getPrefixedKey(key), index);
        } catch (Exception e) {
            logger.error("通过索引获取List中的值失败，key: {}, index: {}", key, index, e);
            return null;
        }
    }

    /**
     * 将list放入缓存
     *
     * @param key   键
     * @param value 值
     * @return 是否成功
     */
    public boolean lSet(String key, Object value) {
        try {
            myRedisTemplate.opsForList().rightPush(getPrefixedKey(key), value);
            return true;
        } catch (Exception e) {
            logger.error("将值添加到List失败，key: {}, value: {}", key, value, e);
            return false;
        }
    }

    /**
     * 将list放入缓存并设置时间
     *
     * @param key   键
     * @param value 值
     * @param time  时间(秒)
     * @return 是否成功
     */
    public boolean lSet(String key, Object value, long time) {
        try {
            myRedisTemplate.opsForList().rightPush(getPrefixedKey(key), value);
            if (time > 0)
                expire(key, time);
            return true;
        } catch (Exception e) {
            logger.error("将值添加到List并设置过期时间失败，key: {}, value: {}", key, value, e);
            return false;
        }
    }

    /**
     * 将list放入缓存
     *
     * @param key   键
     * @param value 值列表
     * @return 是否成功
     */
    public boolean lSet(String key, List<Object> value) {
        try {
            myRedisTemplate.opsForList().rightPushAll(getPrefixedKey(key), value);
            return true;
        } catch (Exception e) {
            logger.error("将值列表添加到List失败，key: {}, values: {}", key, value, e);
            return false;
        }
    }

    /**
     * 将list放入缓存并设置时间
     *
     * @param key   键
     * @param value 值列表
     * @param time  时间(秒)
     * @return 是否成功
     */
    public boolean lSet(String key, List<Object> value, long time) {
        try {
            myRedisTemplate.opsForList().rightPushAll(getPrefixedKey(key), value);
            if (time > 0)
                expire(key, time);
            return true;
        } catch (Exception e) {
            logger.error("将值列表添加到List并设置过期时间失败，key: {}, values: {}", key, value, e);
            return false;
        }
    }

    /**
     * 根据索引修改list中的某条数据
     *
     * @param key   键
     * @param index 索引
     * @param value 新值
     * @return 是否成功
     */
    public boolean lUpdateIndex(String key, long index, Object value) {
        try {
            myRedisTemplate.opsForList().set(getPrefixedKey(key), index, value);
            return true;
        } catch (Exception e) {
            logger.error("更新List中指定索引的值失败，key: {}, index: {}, value: {}", key, index, value, e);
            return false;
        }
    }

    /**
     * 移除N个值为value
     *
     * @param key   键
     * @param count 移除多少个
     * @param value 值
     * @return 移除的个数
     */
    public long lRemove(String key, long count, Object value) {
        try {
            Long removed = myRedisTemplate.opsForList().remove(getPrefixedKey(key), count, value);
            return removed != null ? removed : 0;
        } catch (Exception e) {
            logger.error("从List中移除值失败，key: {}, count: {}, value: {}", key, count, value, e);
            return 0;
        }
    }

}
