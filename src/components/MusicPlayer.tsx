import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { canPrefetch } from '../lib/prefetch';
import './MusicPlayer.css';

/**
 * 背景音乐：一笑倾城。
 *
 * 音频就放在站里（`public/music/yixiaoqingcheng.mp3`），所以是稳定直链，
 * 不依赖任何第三方接口，也不会过期。用 <audio loop> 原生循环。
 *
 * 为什么是现场版：网易云/QQ 音乐的录音室版都是会员曲目，直链只能拿到 30 秒
 * 试听；QQ 音乐上这版 2026 南京音乐节的现场是免费的完整版（汪苏泷本人演唱）。
 *
 * 浏览器不允许无交互自动播放：进页面会先试一次，被拦下就等用户第一次点击
 * 页面任意位置时开始。按钮随时可以暂停/继续。
 *
 * 这首歌 2.3 MB —— 比整页首屏的图片还重。所以「进页面就试」改成了「等页面
 * 加载完、再闲一秒之后才试」，别让它跟照片抢带宽；开了省流量 / 2G-3G 的设备
 * 干脆不自动播，等用户自己点按钮。（canPrefetch 就是同一套网络判断。）
 */
const TRACK = {
  title: '一笑倾城',
  artist: '汪苏泷',
  neteaseId: '426852063',
};

const FILE_URL = `${import.meta.env.BASE_URL}music/yixiaoqingcheng.mp3`;
const EMBED_URL = `https://music.163.com/outchain/player?type=2&id=${TRACK.neteaseId}&auto=1&height=66`;

type Source = 'checking' | 'file' | 'embed';

function MusicBars({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  return (
    <span className={`music__bars${active && !reduced ? ' is-active' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function MusicPlayer() {
  const [source, setSource] = useState<Source>('checking');
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const userPaused = useRef(false);
  /** 用户等不及了直接点按钮：跳过延时，马上探测并播放 */
  const startNow = useRef<() => void>(() => {});

  // 探测音频文件：能读出元数据就用原生播放器，否则退回网易云外链。
  // 延迟到「页面 load 完 + 1.2 秒」之后，让图片先走。
  useEffect(() => {
    let disposed = false;
    let probe: HTMLAudioElement | null = null;
    let settleTimer = 0;
    let startTimer = 0;

    const startProbe = () => {
      if (disposed || probe) return;
      probe = new Audio();
      probe.preload = 'metadata';
      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(settleTimer);
        probe?.removeEventListener('loadedmetadata', onOk);
        probe?.removeEventListener('error', onErr);
        if (probe) probe.src = '';
        if (!disposed) setSource(ok ? 'file' : 'embed');
      };
      const onOk = () => finish(true);
      const onErr = () => finish(false);

      probe.addEventListener('loadedmetadata', onOk);
      probe.addEventListener('error', onErr);
      probe.src = FILE_URL;

      settleTimer = window.setTimeout(() => finish(false), 5000);
    };

    const kick = () => {
      if (disposed || startTimer) return;
      startTimer = window.setTimeout(startProbe, 1200);
    };

    startNow.current = () => {
      window.clearTimeout(startTimer);
      startTimer = 1;
      startProbe();
    };

    let fallback = 0;
    if (document.readyState === 'complete') {
      kick();
    } else {
      window.addEventListener('load', kick, { once: true });
      // 图片多的时候 load 会拖很久，别无限等
      fallback = window.setTimeout(kick, 8000);
    }

    return () => {
      disposed = true;
      window.clearTimeout(startTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(fallback);
      window.removeEventListener('load', kick);
      if (probe) {
        probe.removeAttribute('src');
        probe.load();
      }
    };
  }, []);

  // 有音频就试着放，放不了就等第一次交互（点按钮不算，交给按钮自己处理）
  useEffect(() => {
    if (source !== 'file') return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.65;

    const play = () => {
      if (userPaused.current) return;
      void audio.play().catch(() => {
        /* 还是被拦着，等下一次交互 */
      });
    };

    // 省流量 / 慢网不主动放：2.3 MB 的歌等她想听的时候再下
    if (canPrefetch()) play();

    const onGesture = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.('.music')) return;
      if (!audio.paused) return;
      play();
    };

    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [source]);

  const toggle = () => {
    if (source === 'checking') {
      startNow.current();
      return;
    }
    if (source === 'embed') {
      setOpen((prev) => !prev);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      userPaused.current = false;
      void audio.play().catch(() => setPlaying(false));
    } else {
      userPaused.current = true;
      audio.pause();
    }
  };

  return (
    <div className="music">
      {open && source === 'embed' ? (
        <div className="music__panel">
          <p className="music__panel-title">
            {TRACK.title} · {TRACK.artist}
          </p>
          <iframe
            className="music__frame"
            title={`${TRACK.title} - ${TRACK.artist}`}
            src={EMBED_URL}
            frameBorder="0"
            allow="autoplay; encrypted-media"
          />
          <p className="music__panel-hint">
            网易云官方播放器；会员曲目需要浏览器里登录网易云才能听全曲。
          </p>
        </div>
      ) : null}

      <button
        type="button"
        className={`music__btn${playing ? ' is-playing' : ''}`}
        onClick={toggle}
        aria-pressed={playing}
        aria-label={source === 'embed' ? '打开网易云播放器' : playing ? '暂停音乐' : '播放音乐'}
        title={`${TRACK.title} · ${TRACK.artist}`}
      >
        <MusicBars active={playing || (source === 'embed' && open)} />
        <span className="music__label">
          {playing ? '暂停' : source === 'embed' ? '听歌' : '播放'}
        </span>
      </button>

      {source === 'file' ? (
        <audio
          ref={audioRef}
          src={FILE_URL}
          loop
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      ) : null}
    </div>
  );
}
