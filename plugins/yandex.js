// HGhub HPP 1.0 插件 · Yandex 视频（含 VK 直链解析）
// 搜索/详情来自 yandex.ru/video 内嵌状态；播放对 VK 来源走 vk.com 的 al_video 接口取多清晰度直链。
// 直链落在 okcdn.ru（VK 现用 CDN），国内直连实测 206 video/mp4 可用。
export const meta = {
  id: 'yandex',
  name: 'Yandex 视频',
  version: '1.2.0',
  protocol: 1,
  description: 'Yandex 视频元搜索：搜索、详情、封面、来源标注；VK（四档 mp4）、NTV、Dzen 可直接播放。',
  author: 'workspace',
  kind: 'source',
  linkDomains: ['yandex.ru', 'yandex.com'],
  defaultHeaders: {
    'Accept-Language': 'ru,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
  timeouts: { read: 25, playback: 30 },
};

const SITE = 'https://yandex.ru';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CTL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

export default function (hg) {
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

  async function fetchText(url, ctx, cacheTtl) {
    const opts = {
      url,
      responseType: 'text',
      timeoutMs: 20000,
      maxBytes: 8 * 1024 * 1024,
      signal: ctx && ctx.signal,
    };
    if (cacheTtl) opts.cache = { ttlSec: cacheTtl };
    const res = await hg.http.fetch(opts);
    if (!res.ok) fail('UPSTREAM_ERROR', 'Yandex 返回 HTTP ' + res.status);
    return res.data || '';
  }

  function readState(html) {
    const m = String(html).match(/<noframes[^>]*id="UniAppVideo-PreloadedState"[^>]*>([\s\S]*?)<\/noframes>/i);
    if (!m) return null;
    const raw = m[1];
    const tries = [raw, raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')];
    for (let i = 0; i < tries.length; i++) {
      try { return JSON.parse(tries[i]); } catch (e) {}
    }
    return null;
  }

  function pageOf(cursor) {
    const n = parseInt(cursor || '1', 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

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
    const pl = d.player || {};
    return {
      id: String(videoId),
      title: clean(d.cleanTitle || d.title || it.description || videoId),
      cover: poster ? absUrl(poster) : '',
      host: clean((d.host && d.host.title) || it.greenHost || ''),
      durationSec: (d.duration && d.duration.value) || 0,
      durationText: (d.duration && (d.duration.shortText || d.duration.text)) || '',
      views: (d.views && d.views.text) || '',
      description: clean(it.description || ''),
      playerId: pl.playerId || (d.host && d.host.playerId) || '',
      embedUrl: pl.embedUrl || '',
      pageUrl: pl.videoUrl || (d.host && d.host.href) || '',
    };
  }

  function toItem(e) {
    const item = { id: e.id, title: e.title, type: 'other' };
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
    const arr = [];
    for (let i = 0; i < ids.length; i++) {
      const it = clips.items[ids[i]] || {};
      arr.push({ it: it, i: i });
    }
    arr.sort(function (a, b) {
      const pa = parseInt(a.it.position, 10);
      const pb = parseInt(b.it.position, 10);
      const va = Number.isFinite(pa) ? pa : 1000 + a.i;
      const vb = Number.isFinite(pb) ? pb : 1000 + b.i;
      return va - vb;
    });
    const out = [];
    for (let j = 0; j < arr.length; j++) {
      const item = toItem(entryOf(clips, arr[j].it.videoId));
      if (item.id && item.title) out.push(item);
    }
    return out;
  }

  async function previewEntry(videoId, ctx) {
    const url = origin() + '/video/preview/' + encodeURIComponent(videoId);
    const html = await fetchText(url, ctx);
    const state = readState(html);
    const clips = clipsOf(state);
    return { entry: clips ? entryOf(clips, videoId) : null, html: html };
  }

  // VK：al_video 接口一次返回四档清晰度的直链（okcdn.ru）
  async function vkStreams(pageUrl, ctx) {
    const m = /(?:video|clip)(-?\d+)_(\d+)/.exec(String(pageUrl || ''));
    if (!m) return [];
    let res;
    try {
      res = await hg.http.fetch({
        url: 'https://vk.com/al_video.php?act=show',
        method: 'POST',
        headers: {
          Referer: 'https://vk.com/',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept-Language': 'ru,en;q=0.9',
        },
        body: { form: { act: 'show', al: '1', video: m[1] + '_' + m[2] } },
        responseType: 'text',
        timeoutMs: 20000,
        maxBytes: 8 * 1024 * 1024,
        signal: ctx && ctx.signal,
      });
    } catch (e) {
      return [];
    }
    if (!res || !res.ok) return [];
    const body = String(res.data || '');
    const defs = [['720', '720P', 720], ['480', '480P', 480], ['360', '360P', 360], ['240', '240P', 240]];
    const out = [];
    for (let i = 0; i < defs.length; i++) {
      const re = new RegExp('"url' + defs[i][0] + '"\\s*:\\s*"([^"]+)"');
      const mm = re.exec(body);
      if (!mm || !mm[1]) continue;
      out.push({
        url: mm[1].replace(/\\\//g, '/'),
        kind: 'media',
        format: 'progressive',
        label: defs[i][1],
        height: defs[i][2],
        headers: { 'User-Agent': UA },
      });
    }
    return out;
  }

  // 通用：从嵌入页 HTML 里拾取 m3u8 / mp4 地址
  function pickMediaUrls(body) {
    const out = [];
    const seen = {};
    const marks = ['.m3u8', '.mp4'];
    for (let k = 0; k < marks.length; k++) {
      let idx = 0;
      while (true) {
        const at = body.indexOf(marks[k], idx);
        if (at < 0) break;
        idx = at + 1;
        const start = body.lastIndexOf('http', at);
        if (start < 0) continue;
        const head = body.slice(start, start + 5);
        if (head !== 'http:' && head !== 'https') continue;
        let end = at + marks[k].length;
        while (end < body.length && end - start < 500) {
          const ch = body.charAt(end);
          if (ch === '"' || ch === "'" || ch === ' ' || ch === '\n' || ch === '\r' || ch === '\\' || ch === '<' || ch === '>') break;
          end++;
        }
        const u = body.slice(start, end).replace(/&amp;/g, '&');
        if (u.length > 20 && !seen[u]) {
          seen[u] = 1;
          out.push(u);
        }
        if (out.length >= 4) return out;
      }
    }
    return out;
  }

  // 通用：抓嵌入播放页，从中取直链（ntv / dzen / smotrim 等走这条路）
  async function embedStreams(embedUrl, ctx) {
    if (!embedUrl) return [];
    let res;
    try {
      res = await hg.http.fetch({
        url: embedUrl,
        responseType: 'text',
        timeoutMs: 15000,
        maxBytes: 8 * 1024 * 1024,
        headers: { Referer: origin() + '/' },
        signal: ctx && ctx.signal,
      });
    } catch (e) {
      return [];
    }
    if (!res || !res.ok) return [];
    const urls = pickMediaUrls(String(res.data || ''));
    const out = [];
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      out.push({
        url: u,
        kind: 'media',
        format: /\.m3u8/i.test(u) ? 'hls' : 'progressive',
        headers: { 'User-Agent': UA },
      });
    }
    return out;
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
        return { items: [], next: null };
      },
    },

    search: {
      async search(params, ctx) {
        const q = params && params.query ? String(params.query).trim() : '';
        if (!q) return { items: [], next: null };
        const page = pageOf(params && params.cursor);
        let url = origin() + '/video/search?text=' + encodeURIComponent(q);
        if (page > 1) url += '&p=' + page;
        const html = await fetchText(url, ctx, 120);
        const state = readState(html);
        if (!state) fail('UPSTREAM_CHANGED', 'Yandex 页面结构变化，未找到预加载数据');
        const items = listFrom(state);
        const s = (state.pages && state.pages.search) || {};
        const next = s.hasNextPage && items.length ? String(page + 1) : null;
        return { items: items, next: next };
      },
    },

    media: {
      async getDetail(params, ctx) {
        const id = params && params.id ? String(params.id) : '';
        if (!id) fail('INVALID_ARGUMENT', '缺少作品 ID');
        const got = await previewEntry(id, ctx);
        const e = got.entry;
        if (!e) fail('UPSTREAM_CHANGED', '未解析到该条目的信息');
        const detail = {
          id: e.id,
          title: e.title,
          type: 'movie',
          playlists: [{
            id: 'yandex',
            label: e.host || '播放',
            episodes: [{ id: e.id, index: 1, episodeNumber: 1, label: e.durationText || '播放' }],
          }],
        };
        if (e.cover) detail.cover = e.cover;
        const desc = [];
        if (e.host) desc.push('来源：' + e.host + (e.playerId === 'vk' ? '（可直接播放）' : ''));
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

        if (e.playerId === 'vk' && e.pageUrl) {
          const vk = await vkStreams(e.pageUrl, ctx);
          for (let i = 0; i < vk.length; i++) streams.push(vk[i]);
        }

        if (!streams.length && e.embedUrl) {
          const em = await embedStreams(e.embedUrl, ctx);
          for (let i = 0; i < em.length; i++) streams.push(em[i]);
        }

        if (!streams.length) {
          const direct = String(got.html).match(/https?:\\?\/\\?\/[^"'\s\\]+?\.(?:m3u8|mp4)(?:\?[^"'\s\\]*)?/i);
          if (direct) {
            const u = direct[0].replace(/\\\//g, '/').replace(/\\u002F/g, '/');
            streams.push({
              url: u,
              kind: 'media',
              format: /\.m3u8/i.test(u) ? 'hls' : 'progressive',
              headers: { 'User-Agent': UA },
            });
          }
        }

        if (!streams.length && e.embedUrl) {
          const s = { url: e.embedUrl, kind: 'page', headers: { 'User-Agent': UA } };
          if (e.playerId) s.resolverId = e.playerId;
          streams.push(s);
        }
        if (!streams.length && e.pageUrl) {
          streams.push({ url: e.pageUrl, kind: 'external' });
        }
        if (!streams.length) {
          fail('UNSUPPORTED', '该条目没有可用播放地址（来源：' + (e.host || '未知') + '）');
        }
        return { streams: streams, durationSec: e.durationSec || undefined };
      },
    },
  };
}
