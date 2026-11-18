# Yandex 视频 —— HGhub 插件（HPP 1.0）

**文件**：`yandex.js`（9.4 KB，单文件，无依赖）
**协议**：HPP 1.0（HGhub v0.0.2 宿主）
**写于**：2026-11-17 · 自测通过（假宿主 + 真实 Yandex 页面）

## 它做什么

把 yandex.ru/video 当成一个内容源接进 HGhub：

| 能力 | 实现 |
|---|---|
| 搜索 | `yandex.ru/video/search?text=<词>`，翻页 `&p=N`，从页面内嵌 `UniAppVideo-PreloadedState` 取结构化数据 |
| 详情 | `/video/preview/<videoId>`，返回标题、封面、时长、来源站点、观看数、发布日期 |
| 播放 | 分三级：① 页面里若有 m3u8/mp4 直链 → `media`；② 嵌入播放页 → `page` + `resolverId`（如 rutube）；③ 兜底 → `external`（交给系统浏览器打开来源页） |

## 为什么播放要分级

Yandex 是**元搜索**：它自己不托管视频，条目落在 rutube、VK Видео、Mail.ru、dzen 等站点。
所以插件能给的是"找到片"，能不能在应用内直接播，取决于对应来源的解析器是否安装、以及网络能不能到那个源站。

**实测（2026-11-17，本机）**：

- `yandex.ru` 直连 200，无需代理；搜索/预览页均无验证码。
- `rutube.ru` **直连超时**，走 127.0.0.1:7900 代理才 200；且其公开接口不再返回 m3u8（`api/video/<id>/` 的 `video_balancer` 为空，`api/play/options/` 返回 244/404）。
- VK Видео同样需要专门解析。

结论：**在国内网络、手机端（走设备网络、没有代理）下，这个源的播放大概率落到"外部打开"这一档**。搜索、浏览、详情完全可用。

## 安装

1. 打开 HGhub → 插件中心 → 导入与订阅
2. 选"插件文件"，选本目录下的 `yandex.js`
3. 确认状态为"已就绪"，在设置里把首页来源或搜索来源切到"Yandex 视频"

也可以放进你自己的插件列表仓库，把 `yandex.js` 加到 `manifest.json` 的 `plugins` 数组，`url` 写相对路径。

## 配置项

- 站点线路：`yandex.ru` / `yandex.com`（`endpoints.list()`），设置里可切换。
- 语言头默认 `ru,en;q=0.9`，改 `meta.defaultHeaders` 即可。

## 已知限制

- 首页无内容（Yandex 没有稳定的无参视频首页），只用搜索入口。
- 没有分类目录，Yandex 视频侧不提供。
- 搜索结果里的时长/观看数是 Snippet 自带值，可能与来源站点实际不一致。
- 页面结构若改版（`UniAppVideo-PreloadedState` 改名或换位置），插件会报 `UPSTREAM_CHANGED`。

## 自测结果（真实请求）

```
meta: yandex Yandex 视频 1.0.0
SEARCH items = 17 | next = 2
  1. 15167207815821873403 | Матрица | The Matrix (1999) | Rutube | 2ч 16 мин · 348,4K 次观看
  2. 163315510202561215 | Шматрица (1999) — Видео от Наши 90-е | VK Видео | ...
DETAIL: { id, title, type: movie, playlists[1], cover: avatars.mds.yandex.net/..., durationSec: 8176 }
PLAYBACK:
   kind=page     resolver=rutube  https://rutube.ru/play/embed/06f4c1.../?autoStart=true&wmode=opaque
   kind=external                  http://rutube.ru/video/06f4c1dd1b319392aedc768867b4980f/
```
