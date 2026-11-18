# Yandex 视频 —— HGhub 插件（HPP 1.0）

**文件**：`yandex.js`（12.5 KB，单文件，无依赖）
**版本**：1.2.0 · **协议**：HPP 1.0 · **宿主**：HGhub v0.0.2（Android / 桌面）
**验证**：2026-11-18 · QuickJS-ng 0.18.0 与 0.10.1 双引擎 · 真实 Yandex / VK / NTV / Dzen 响应

## 能力

| 能力 | 实现 |
|---|---|
| 搜索 | `yandex.ru/video/search?text=`，翻页 `&p=N`，读 `noframes#UniAppVideo-PreloadedState` |
| 详情 | `/video/preview/<id>`，标题/封面/时长/来源/观看数 |
| 播放（VK） | 调 `vk.com/al_video.php?act=show`（POST）→ **720P/480P/360P/240P 四档 mp4 直链**（`*.vkuser.net` / `*.okcdn.ru`） |
| 播放（其他） | 抓嵌入页通用扫描 m3u8/mp4 —— NTV（`media2-k.ntv.ru`）、Dzen（`vd669.okcdn.ru`）实测可取 |
| 兜底 | `page`（交解析器）/ `external`（系统浏览器） |

## 实测：直链在国内真能取

| 来源 | 直链主机 | 实测 |
|---|---|---|
| VK | `vk6-1.vkuser.net` (95.142.206.160) | 4 档全部 **206 video/mp4** |
| VK | `vkvd520.okcdn.ru` (185.226.55.158) | **206 video/mp4** |
| NTV | `media2-k.ntv.ru` (185.129.100.162) | **200 audio/x-mpegurl**（HLS 播放列表） |
| Dzen | `vd669.okcdn.ru` (178.237.23.20) | **200 application/x-mpegURL** |

## 覆盖率（97 条 Yandex 结果样本）

| 来源 | 占比 | 状态 |
|---|---|---|
| vk.com | 47% | ✅ 可播（四档） |
| rutube.ru | 21% | ❌ DNS 污染，主站与 CDN 都不通 |
| ok.ru | 10% | ❌ 主站污染 |
| mail.ru | 9% | ❌ 嵌入页无直链 |
| youtube | 6% | ❌ 被墙 |
| smotrim / ntv / dzen / vh | 各 1–3% | ✅ ntv、dzen 可播；smotrim 降级 page |

**约一半的搜索结果能直接在应用里播放。**

## APK 侧运行环境（从 `HGhub_0.0.2_arm64.apk` 挖出）

| 项 | 值 |
|---|---|
| 包名 | `com.hghub.player` |
| 原生库 | `lib/arm64-v8a/libhuangguo_client_lib.so`（10.76 MB，单库） |
| 插件运行时 | **rquickjs-core 0.12.2 + QuickJS-ng** |
| HPP 实现 | `crates/hpp/src/{runtime,manager,capabilities,media,network}.rs` |

本插件在 **QuickJS-ng 0.18.0** 与 **0.10.1**（rquickjs 0.12.2 同代）上都跑通，代码只用 ES2017 语法。

## 关键实现细节

1. **VK 必须带 Referer**：`al_video.php` 无 `Referer: https://vk.com/` 只返回 943 字节空壳，带了才是 300 KB 含直链。
2. **直链只需 User-Agent**：实测无 Referer 也能下（206），但空 UA 会被拒，所以 stream 里显式给 UA。
3. **直链带 `srcIp`**：VK 把请求方 IP 写进签名，所以必须在**播放设备上实时获取**，不能缓存分享。
4. **README 说到的宿主限制**：HPP 网络层只允许 https、限速 5 次/秒、单主机 ≤4，无域名白名单，跨源请求合法。

## 安装

订阅地址（jsDelivr，国内直连实测 200）：

```
https://cdn.jsdelivr.net/gh/Beihaisir/HGhub-plugins@main/manifest.json
```

或文件导入本目录的 `yandex.js`。装好后在设置里把搜索来源切到「Yandex 视频」。

## 限制

- Yandex 对成人向关键词（эротика / взрослое видео）返回 0 条，属上游过滤，插件绕不过。
- VK 条目的成人内容可通过 VK 播放通路放，但需要能搜到。
- rutube / ok / youtube 三类仍不可用（DNS 污染 / 被墙），只能外部打开。
- 页面改版（`UniAppVideo-PreloadedState` 改名）会报 `UPSTREAM_CHANGED`。

## 测试输出（QuickJS-ng，真实响应夹具）

```
SEARCH items=17 next=2
vk -> 4 streams
    720P:media:https://vk6-1.vkuser.net/?srcIp=...
    480P:media:https://vk6-1.vkuser.net/?srcIp=...
    360P:media:https://vk6-1.vkuser.net/?srcIp=...
    240P:media:https://vk6-1.vkuser.net/?srcIp=...
ntv -> 1 streams
    media:media:https://media2-k.ntv.ru/promo/packager/ts/...
zen -> 1 streams
    media:media:https://vd669.okcdn.ru/video.m3u8?srcIp=...
smotrim -> 1 streams
    page:page:https://player.smotrim.ru/iframe/video/id/2237...
QUICKJS_OK
```
