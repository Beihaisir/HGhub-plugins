// HGhub HPP 1.0 插件 · Yandex 视频（元搜索源）
// 数据来源：yandex.ru/video 搜索页与预览页内嵌的 UniAppVideo-PreloadedState
// 播放：Yandex 本身不托管视频，条目实际落在 rutube / vk / dzen 等来源。
//       本插件优先返回可直接播放的直链；拿不到时给出播放页（需解析器）或外部打开地址。
export const meta = {
  id: 'yandex',
  name: 'Yandex 视频',
  version: '1.0.0',
  protocol: 1,
  description: 'Yandex 视频元搜索：搜索、详情、来源标注；播放交给条目所在来源（直链 / 播放页 / 外部打开）。',
  author: 'workspace',
  kind: 'source',
  linkDomains: ['yandex.ru', 'yandex.com'],
  defaultHeaders: {
    'Accept-Language': 'ru,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
  timeouts: { read: 25, playback: 25 },
};

const SITE = 'https://yandex.ru';

export default function (hg) {
  const CTL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

  function origin() {
    const cur = hg.endpoint && hg.endpoint.current;
    if (cur && typeof cur.url === 'string' && cur.url) return cur.url.replace(/\/$/, '');
    return SITE;
  }

  function fail(code, message) {
    throw new hg.PluginError(code, message);
  }

  function clean(s) {
    return String(s == null ? '' : s).replace(CTL, '').trim();
  }

  function absUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (u.indexOf('//') === 0) return 'https:' + u;
    return origin() + (u.charAt(0) === '/' ? u : '/' + u);
  }

  async function fetchText(url, ctx) {
    const res = await hg.http.fetch({
      url,
      responseType: 'text',
      timeoutMs: 20000,
      retry: 1,
      maxBytes: 12 * 1024 * 1024,
      signal: ctx && ctx.signal,
    });
    if (!res.ok) fail('UPSTREAM_ERROR', 'Yandex 返回 HTTP ' + res.status);
    return res.data || '';
  }

  // noframes#UniAppVideo-PreloadedState 里是整页状态 JSON
  function readState(html) {
    const m = String(html).match(/<noframes[^>]*id="UniAppVideo-PreloadedState"[^>]*>([\s\S]*?)<\/noframes>/i);
    if (!m) return null;
    const raw = m[1];
    const tries = [
      raw,
      raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'"),
    ];
    for (let i = 0; i < tries.length; i++) {
      try { return JSON.parse(tries[i]); } catch (e) {}
    }
    return null;
  }

  function pageOf(cursor) {
    const n = parseInt(cursor || '1', 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  // 从状态里取 clips 结构（搜索页在 clips.*，预览页在 viewer.clips.*）
  function clipsOf(state) {
    if (!state) return null;
    if (state.clips && state.clips.items) return state.clips;
    if (state.viewer && state.viewer.clips && state.viewer.clips.items) return state.viewer.clips;
    return null;
  }

  function entryOf(clips, videoId) {
    const items = (clips && clips.items) || {};
    const dups = (clips && clips.dups) || {};
    const it = items[videoId] || {};
    const d = dups[videoId] || {};
    const poster = it.preview && it.preview.posterSrc;
    const host = (d.host && d.host.title) || it.greenHost || '';
    return {
      id: String(videoId),
      title: clean(d.cleanTitle || d.title || it.description || videoId),
      cover: poster ? absUrl(poster) : '',
      host: clean(host),
      durationSec: (d.duration && d.duration.value) || 0,
      durationText: (d.duration && (d.duration.shortText || d.duration.text)) || '',
      views: (d.views && d.views.text) || '',
      date: d.date || '',
      description: clean(it.description || ''),
      playerId: (d.player && d.player.playerId) || (d.host && d.host.playerId) || '',
      embedUrl: (d.player && d.player.embedUrl) || '',
      pageUrl: (d.player && d.player.videoUrl) || (d.host && d.host.href) || '',
      href: d.href || d.rawHref || '',
    };
  }

  function toItem(e) {
    const item = {
      id: e.id,
      title: e.title,
      type: e.durationSec && e.durationSec > 5400 ? 'movie' : 'other',
    };
    if (e.cover) item.cover = e.cover;
    const badge = e.host ? e.host.slice(0, 8) : '';
    if (badge) item.badge = badge;
    const sub = [];
    if (e.durationText) sub.push(e.durationText);
    if (e.views) sub.push(e.views + ' 次观看');
    if (sub.length) item.subtitle = sub.join(' · ');
    return item;
  }

  function listFrom(state) {
    const clips = clipsOf(state);
    if (!clips) return [];
    const ids = Object.keys(clips.items || {});
    return ids
      .map(function (id) { return clips.items[id] || {}; })
      .map(function (it, i) { return { it: it, i: i }; })
      .sort(function (a, b) {
        const pa = parseInt(a.it.position, 10);
        const pb = parseInt(b.it.position, 10);
        return (Number.isFinite(pa) ? pa : a.i) - (Number.isFinite(pb) ? pb : b.i);
      })
      .map(function (w) { return toItem(entryOf(clips, w.it.videoId)); })
      .filter(function (x) { return x.id && x.title; });
  }

  async function searchPage(query, page, ctx) {
    let url = origin() + '/video/search?text=' + encodeURIComponent(query);
    if (page > 1) url += '&p=' + page;
    const html = await fetchText(url, ctx);
    const state = readState(html);
    if (!state) fail('UPSTREAM_CHANGED', 'Yandex 页面结构变化，未找到预加载数据');
    const s = (state.pages && state.pages.search) || {};
    const items = listFrom(state);
    let next = null;
    if (s.hasNextPage) next = String(page + 1);
    else if (items.length) next = null;
    return { items: items, next: next };
  }

  async function previewEntry(videoId, ctx) {
    const url = origin() + '/video/preview/' + encodeURIComponent(videoId);
    const html = await fetchText(url, ctx);
    const state = readState(html);
    const clips = clipsOf(state);
    if (!clips) return { entry: null, html: html };
    return { entry: entryOf(clips, videoId), html: html };
  }

  return {
    endpoints: {
      list() {
        return [
          { id: 'ru', label: 'yandex.ru', url: SITE },
          { id: 'com', label: 'yandex.com', url: 'https://yandex.com' },
        ];
      },
    },

    home: {
      async getSections() {
        // Yandex 视频没有稳定的无参首页，首页留给搜索入口
        return { items: [], next: null };
      },
    },

    search: {
      async search(params, ctx) {
        const q = params && params.query ? String(params.query).trim() : '';
        if (!q) return { items: [], next: null };
        return searchPage(q, pageOf(params && params.cursor), ctx);
      },
    },

    media: {
      async getDetail(params, ctx) {
        const id = params && params.id ? String(params.id) : '';
        if (!id) fail('INVALID_ARGUMENT', '缺少作品 ID');
        const got = await previewEntry(id, ctx);
        const e = got.entry;
        if (!e) fail('UPSTREAM_CHANGED', '未解析到该条目的信息');
        const label = e.host || '播放';
        const detail = {
          id: e.id,
          title: e.title,
          type: 'movie',
          playlists: [{
            id: 'yandex',
            label: label,
            episodes: [{
              id: e.id,
              index: 1,
              episodeNumber: 1,
              label: e.durationText || '播放',
            }],
          }],
        };
        if (e.cover) detail.cover = e.cover;
        const desc = [];
        if (e.host) desc.push('来源：' + e.host);
        if (e.date) desc.push(e.date);
        if (e.views) desc.push(e.views + ' 次观看');
        if (e.description) desc.push(e.description);
        if (desc.length) detail.description = desc.join('\n');
        if (e.durationSec) detail.durationSec = e.durationSec;
        return detail;
      },

      async resolvePlayback(params, ctx) {
        const episodeId = params && params.episodeId ? String(params.episodeId) : '';
        if (!episodeId) fail('INVALID_ARGUMENT', '缺少分集 ID');
        const got = await previewEntry(episodeId, ctx);
        const e = got.entry;
        if (!e) fail('UPSTREAM_CHANGED', '未解析到该条目的播放信息');

        const streams = [];

        // 1) 页面里若有可直接播放的媒体地址，优先给出
        const direct = String(got.html).match(/https?:\\?\/\\?\/[^"'\s\\]+?\.(?:m3u8|mp4)(?:\?[^"'\s\\]*)?/i);
        if (direct) {
          const u = direct[0].replace(/\\\//g, '/').replace(/\\u002F/g, '/');
          streams.push({
            url: u,
            kind: 'media',
            format: /\.m3u8/i.test(u) ? 'hls' : 'progressive',
            headers: { Referer: origin() + '/' },
          });
        }

        // 2) 常驻的嵌入播放页：交给同 id 的解析器插件处理
        if (e.embedUrl) {
          const s = { url: e.embedUrl, kind: 'page', headers: { Referer: origin() + '/' } };
          if (e.playerId) s.resolverId = e.playerId;
          streams.push(s);
        }

        // 3) 兜底：外部打开来源页面
        if (e.pageUrl) streams.push({ url: e.pageUrl, kind: 'external' });

        if (!streams.length) {
          fail('UNSUPPORTED', '该条目没有可用的播放地址（来源：' + (e.host || '未知') + '）');
        }
        return { streams: streams, durationSec: e.durationSec || undefined };
      },
    },
  };
}
