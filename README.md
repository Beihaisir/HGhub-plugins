# Yandex 视频 —— HGhub 插件（HPP 1.0）

**文件**：`yandex.js`（9.4 KB，单文件，无依赖）
**协议**：HPP 1.0 · 目标宿主 HGhub v0.0.2（Android / 桌面）
**验证**：2026-11-18 复测，QuickJS-ng 0.18.0 与 0.10.1 双引擎跑通，真实 Yandex 页面数据

## 它做什么

把 yandex.ru/video 当成一个内容源接进 HGhub：

| 能力 | 实现 |
|---|---|
| 搜索 | `yandex.ru/video/search?text=<词>`，翻页 `&p=N`，从页面内嵌 `noframes#UniAppVideo-PreloadedState` 取结构化 JSON |
| 详情 | `/video/preview/<videoId>`，标题、封面、时长、来源站点、观看数、发布日期 |
| 播放 | 三级降级：① 页面有 m3u8/mp4 直链 → `media`；② 嵌入播放页 → `page` + `resolverId`；③ 兜底 → `external` 交给系统浏览器 |

## APK 侧运行环境（实测自 `HGhub_0.0.2_arm64.apk`）

从安装包里挖出来的事实，不是推测：

| 项 | 值 | 证据 |
|---|---|---|
| 包名 | `com.hghub.player` | `assets/tauri.conf.json` |
| 原生库 | `lib/arm64-v8a/libhuangguo_client_lib.so`（10.76 MB，单库） | APK 内仅一个 .so |
| 插件运行时 | **rquickjs-core 0.12.2 + QuickJS-ng** | .so 内 `rquickjs-core-0.12.2/src/...`、`QuickJS-ng memory usage -- %s version` |
| HPP 实现位置 | `crates/hpp/src/*`（runtime/manager/capabilities/media/network …） | .so 内源码路径字符串 |
| 构建链 | rustc 1.100.0，clang 22，2026-11-09 | .so 内版本串 |

**所以插件是跑在 QuickJS-ng 上，不是 V8 / JSC。** 本插件已在两个 QuickJS-ng 版本上实测：

| 引擎 | 结果 |
|---|---|
| QuickJS-ng **0.18.0** | `SEARCH items=17 next=2` / DETAIL ok / `PLAYBACK page(rutube)+external` / `QUICKJS_OK` |
| QuickJS-ng **0.10.1**（rquickjs 0.12.2 同代） | 同上，完全一致 |

代码只用 ES2017 级语法（无 `?.`、`??`、`replaceAll`、`.at()`、`matchAll`、`Object.fromEntries`），已扫描确认。

## 网络实测（2026-11-18，本机直连，未走代理）

| 目标 | 结果 |
|---|---|
| `yandex.ru/video/search` | **6/6 成功**，2.43–2.93s，每次 52 个 videoId，492 字节级内容完整 |
| `yandex.ru/video/preview` | 3/3 200，2.0–2.4s |
| TLS | TLSv1.3 / GlobalSign GCC E46 OV TLS CA 2025 / 证书 `*.yandex.ru`，YANDEX LLC，2026-10-12 → 2027-04-29 |
| DNS | yandex.ru → 5.255.255.77 / 77.88.44.55 / 77.88.55.88（Yandex 自有网段） |
| 封面 CDN `avatars.mds.yandex.net` | 解析正常（87.250.247.181-183） |
| `yandex.ru` 首页 | ⚠️ TLS 证书链校验失败（`unable to get local issuer certificate`）——本插件不依赖首页 |
| `rutube.ru` | ❌ 3/3 连接超时（10060），IP 199.96.62.75；走 127.0.0.1:7900 代理才 200 |
| `vk.com` 桌面 | ❌ 连接超时；`m.vk.com` 200 但页面不吐直链 |

结论：**Yandex 搜索/详情链路稳定可用；播放源（rutube / VK）在国内直连拿不到。** 手机走同一宽带 Wi-Fi 时结果基本一致；走 4G 会因运营商路由不同可能有差异。

## 安装

1. HGhub → 插件中心 → 导入与订阅
2. 粘订阅地址（推荐 jsDelivr，直连实测 200）：
   `https://cdn.jsdelivr.net/gh/Beihaisir/HGhub-plugins@main/manifest.json`
3. 或直接用文件导入本目录的 `yandex.js`
4. 确认状态"已就绪"，把搜索来源切到"Yandex 视频"

## 已知限制

- 首页无内容（Yandex 没有稳定的无参视频首页），只有搜索入口；无分类目录。
- 播放受上游来源网络可达性限制，见上表。真要片源得配解析器或用社区影视源。
- 页面若改版（`UniAppVideo-PreloadedState` 改名/换位）会报 `UPSTREAM_CHANGED`。
- 时长/观看数取 Snippet 自带值，可能与来源站实际不一致。

## 实测输出（QuickJS-ng 0.10.1，真实页面）

```
meta=yandex 1.0.0 | search bytes=391747 preview bytes=268561
SEARCH items=17 next=2
  1. Матрица | The Matrix (1999) | Rutube | 2ч 16 мин · 348,4K 次观看 | cover=y
  2. Матрица (фильм 1999) / The Matrix | Rutube | 2ч 16 мин · 1,5M 次观看 | cover=y
  3. Матрица (1999) | Фильм.  4K — Видео от PLAYКино | VK Видео | 2ч 2 мин · 6,4K 次观看 | cover=y
DETAIL title=Матрица | The Matrix (1999) cover=yes eps=1
PLAYBACK page(rutube) + external
QUICKJS_OK
```
