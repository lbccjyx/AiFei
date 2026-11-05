import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
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

  // 探测音频文件：能读出元数据就用原生播放器，否则退回网易云外链
  useEffect(() => {
    const probe = new Audio();
    probe.preload = 'metadata';
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      probe.removeEventListener('loadedmetadata', onOk);
      probe.removeEventListener('error', onErr);
      probe.src = '';
      setSource(ok ? 'file' : 'embed');
    };
    const onOk = () => finish(true);
    const onErr = () => finish(false);

    probe.addEventListener('loadedmetadata', onOk);
    probe.addEventListener('error', onErr);
    probe.src = FILE_URL;

    const timer = window.setTimeout(() => finish(false), 5000);
    return () => {
      window.clearTimeout(timer);
      finish(false);
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

    play();

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
    if (source === 'checking') return;
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
