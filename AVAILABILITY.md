# 国内网络实测清单（2026-11-18 · 贵州电信直连 · 出口 222.85.215.2）

## 一、Yandex 本体（俄罗斯搜索引擎）

| 项 | 结果 |
|---|---|
| 搜索连续性 | **6/6 成功**，2.43–2.93s，每次 17–52 条，内容完整 |
| DNS 是否污染 | **未污染**（本地 = DoH = 5.255.255.77 / 77.88.44.55 / 77.88.55.88，Yandex 莫斯科 AS13238） |
| IP 直连 | 302 / 0.8s（绕过 DNS 测试） |
| TLS 证书 | YANDEX LLC / GlobalSign，有效期 2026-10-12 → 2027-04-29 |
| 封面 CDN | avatars.mds.yandex.net 实取 200 / 29KB / image/jpeg |

**结论：能搜，稳定。**

## 二、Yandex 搜索结果落在哪（97 条样本）

| 播放源 | 占比 | 国内可达 | 说明 |
|---|---|---|---|
| vk.com | 47% | ⚠️ 主站通，参考 CDN 被墙（vkuservideo.net / sun9.userapi.com 超时） | 跳 vkvideo.ru 后 20.8s 超时 |
| rutube.ru | 21% | ❌ DNS 污染（返回 Facebook/Twitter/Dropbox 段 IP）+ rtbcdn.ru NXDOMAIN | 被墙，非战损 |
| ok.ru | 10% | ❌ DNS 污染（157.240.7.5 = Facebook） | 主站不通 |
| mail.ru | 9% | ✅ video.mail.ru 301 可达 | 需测直链 |
| youtube | 6% | ❌ | — |
| smotrim.ru | 3% | ✅ 200 + vod.smotrim.ru MP4 可采样（206） | 官方台，能播但站不稳定 |
| dzen.ru | 1% | ✅ 302 | — |

**结论：搜出来的片子约 78% 落在被墙的源上，点开播不了。**

## 三、成人内容

| 测试 | 结果 |
|---|---|
| Yandex 搜 "эротика" / "взрослое видео" | **返回 0 条** —— Yandex 自己做了过滤 |
| Yandex 搜 "18+ фильм" | 17 条，但无 adult 标记，来源仍是 vk/mailru/ok/rutube |

**结论：Yandex 这条路给不了成人内容。**

## 四、社区 21 个插件源实测（CoderL98/hghub-plugins）

### 影视源：8/14 可用

| 可用 | 域名 | HTTP |
|---|---|---|
| 4k-av | 4kmp.com | 403（Cloudflare 挑战，插件内正常） |
| anfuns | www.anfuns.org | 200 |
| 短剧天堂 | duanjutt.tv | 200 |
| hdmoli | hdmoli.pro | 200 |
| 韩剧看看 | hanjukankan.com | 302 |
| 绝对影视 | www.jdys.art | 200 |
| 金牌影视 | jiabaide.cn / m.jiabaide.cn | 200 |
| 小红影视 | xiaohys.com | 200 |

不可用：小苹果（xpgtv.net）、天天影视（ysdqjs.cn）、农民影视（nmvod.me / wwgz.cn）、星芽短剧（whjzjx.cn 503）、烧火电影（shdy2.com 522）

### 成人源：0/7 可用

| 源 | 域名 | HTTP |
|---|---|---|
| avtoday | avtoday.io | 超时 |
| Hanime1 | hanime1.me | 超时 |
| 玩偶姐姐 | hongkongdollvideo.com | 超时 |
| 黄果短剧 | huangguoai.ai / .com | 超时 |
| 麻豆社 | madou.club | 超时 |
| Pornhub | pornhub.com / cn.pornhub.com | 超时 |
| xHamster | xhamster.com / zh.xhamster.com | 超时 |

**7 个成人源在国内直连全部不通。**

## 五、俄语影视站批量体检（另测）

可达（HTTP 200/301）：kinopoisk.ru、ivi.ru、okko.tv、wink.ru、more.tv、premier.one、kion.ru、start.ru、1tv.ru、ntv.ru、smotrim.ru、dzen.ru、hdrezka.ag / hdrezka.fi / hdrezka-home.tv、rezka.ag、zetflix.ru

但：
- **hdrezka 系**有 Anubis 反爬（"Проверяем, что вы не бот!" + PoW 挑战），插件里做 PoW 不现实
- **smotrim.ru** 时通时断（同一小时内 200 → 0）
- ivi/okko/wink/kion/premier 需要登录或付费，公开 API 未验证
