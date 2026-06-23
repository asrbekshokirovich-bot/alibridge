import { useEffect, useMemo, useRef, useState } from 'react'

// "TAS → IST reys" ochilish ekrani — yuklanish tugaguncha aylanib turadi.
// Vizual manba: alibridge-splash2.html (chuqur tungi osmon, glassmorphism
// shahar chiplari, neon iz, glow va progress bar).
//
// Sahna 340×710 fikslangan koordinatada qurilgan (reference bilan bir xil),
// so'ng viewport'ga "contain" qilib masshtablanadi. Tashqi fon bir xil
// vertikal osmon gradienti — chetdagi bo'sh joy ko'rinmas tarzda qo'shiladi.

const PLANE = 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z'
const ARC = 'M 56 472 Q 170 286 286 408'

export function SplashScreen() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [reduced, setReduced] = useState(false)

  // 26 ta yulduz — bir marta generatsiya qilinadi (yuqori ~60%)
  const stars = useMemo(
    () => Array.from({ length: 26 }, () => ({
      left: Math.random() * 100,
      top: Math.random() * 60,
      delay: Math.random() * 3,
    })),
    [],
  )

  // Harakatni kamaytirish (accessibility)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  // Sahnani viewport'ga "contain" qilib markazlashtiramiz
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const fit = () => {
      const s = Math.min(window.innerWidth / 340, window.innerHeight / 710)
      el.style.transform = `translate(-50%, -50%) scale(${s})`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <div className={`ab-splash${reduced ? ' is-reduced' : ''}`} role="status" aria-label="Yuklanmoqda">
      <style>{CSS}</style>

      <div className="ab-stage" ref={stageRef}>
        {/* Osmon + atmosfera */}
        <div className="s-sky" />
        <div className="s-glow" />
        <div className="s-stars">
          {stars.map((st, i) => (
            <i key={i} style={{ left: `${st.left}%`, top: `${st.top}%`, animationDelay: `${st.delay}s` }} />
          ))}
        </div>
        <div className="s-haze s-h1" />
        <div className="s-haze s-h2" />
        <div className="s-haze s-h3" />

        {/* Marshrut (nuqtali yoy) + neon iz */}
        <svg className="s-route" viewBox="0 0 340 710" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ab-trail-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#2f5aa0" />
              <stop offset="1" stopColor="#D4E94C" />
            </linearGradient>
          </defs>
          <path className="s-path-dot" d={ARC} />
          <path className="s-trail" d={ARC} />
        </svg>

        {/* Samolyot — yoy bo'ylab uchadi */}
        <div className="s-plane">
          <svg viewBox="0 0 24 24" fill="#fff"><path d={PLANE} /></svg>
        </div>

        {/* Shahar chiplari (glassmorphism) */}
        <div className="s-city s-tas">
          <span className="s-pin s-live" />
          <span className="s-lbl"><small>TAS</small> Toshkent</span>
        </div>
        <div className="s-city s-ist">
          <span className="s-pin s-dim" />
          <span className="s-lbl"><small>IST</small> Istanbul</span>
        </div>

        {/* Brend bloki */}
        <div className="s-brand">
          <div className="s-logo">
            <svg width="31" height="31" viewBox="0 0 24 24" fill="#fff"><path d={PLANE} /></svg>
          </div>
          <div className="s-eyebrow">Kargo logistikasi</div>
          <div className="s-word">ALI<b> BRIDGE</b></div>
          <div className="s-sub">Toshkent → Istanbul</div>
          <div className="s-bar"><i /></div>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.ab-splash{position:fixed;inset:0;z-index:9999;overflow:hidden;
  background:linear-gradient(180deg,#0b1a33 0%,#13294d 34%,#1f3f70 66%,#3b6bab 100%);
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif}
.ab-stage{position:absolute;left:50%;top:50%;width:340px;height:710px;
  transform:translate(-50%,-50%);transform-origin:center center;overflow:hidden}

/* Osmon */
.ab-splash .s-sky{position:absolute;inset:0;
  background:
    radial-gradient(120% 70% at 50% 12%, rgba(120,170,255,.35), transparent 55%),
    linear-gradient(180deg,#0b1a33 0%,#13294d 34%,#1f3f70 66%,#3b6bab 100%)}
.ab-splash .s-glow{position:absolute;left:-20%;right:-20%;bottom:-8%;height:42%;
  background:radial-gradient(60% 100% at 50% 100%, rgba(212,233,76,.16), rgba(120,170,255,.10) 45%, transparent 72%)}

/* Yulduzlar */
.ab-splash .s-stars{position:absolute;inset:0;opacity:.5}
.ab-splash .s-stars i{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;opacity:.5;
  animation:absp_tw 3s ease-in-out infinite}
@keyframes absp_tw{0%,100%{opacity:.2}50%{opacity:.9}}

/* Atmosfera chiziqlari */
.ab-splash .s-haze{position:absolute;height:1px;left:-40%;width:80%;border-radius:2px;filter:blur(.5px);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);
  animation:absp_slide 14s linear infinite}
.ab-splash .s-h1{top:30%;animation-duration:18s}
.ab-splash .s-h2{top:44%;width:55%;animation-duration:22s;animation-delay:-7s;opacity:.7}
.ab-splash .s-h3{top:58%;width:70%;animation-duration:16s;animation-delay:-3s;opacity:.5}
@keyframes absp_slide{from{transform:translateX(0)}to{transform:translateX(190%)}}

/* Marshrut + iz */
.ab-splash .s-route{position:absolute;inset:0;width:100%;height:100%}
.ab-splash .s-path-dot{stroke:rgba(255,255,255,.28);stroke-width:1.5;fill:none;stroke-dasharray:1 7;stroke-linecap:round}
.ab-splash .s-trail{stroke:url(#ab-trail-grad);stroke-width:2.5;fill:none;stroke-linecap:round;
  stroke-dasharray:300;stroke-dashoffset:300;animation:absp_draw 3.6s cubic-bezier(.4,0,.2,1) infinite}
@keyframes absp_draw{0%{stroke-dashoffset:300;opacity:0}10%{opacity:1}55%{stroke-dashoffset:0;opacity:1}80%{opacity:0;stroke-dashoffset:0}100%{opacity:0}}

/* Samolyot */
.ab-splash .s-plane{position:absolute;width:30px;height:30px;left:0;top:0;
  offset-path:path('M 56 472 Q 170 286 286 408');offset-rotate:auto;
  animation:absp_fly 3.6s cubic-bezier(.4,0,.2,1) infinite}
@keyframes absp_fly{0%{offset-distance:0%;opacity:0}10%{opacity:1}90%{opacity:1}100%{offset-distance:100%;opacity:0}}
.ab-splash .s-plane svg{width:30px;height:30px;filter:drop-shadow(0 0 8px rgba(212,233,76,.55))}

/* Shahar chiplari */
.ab-splash .s-city{position:absolute;display:flex;flex-direction:column;gap:7px}
.ab-splash .s-pin{position:relative;width:11px;height:11px;border-radius:50%;background:#D4E94C;
  box-shadow:0 0 0 4px rgba(212,233,76,.18),0 0 12px rgba(212,233,76,.6)}
.ab-splash .s-pin.s-dim{background:#9fc3ff;box-shadow:0 0 0 4px rgba(159,195,255,.16),0 0 10px rgba(159,195,255,.5)}
.ab-splash .s-pin.s-live:after{content:"";position:absolute;left:0;top:0;width:11px;height:11px;border-radius:50%;
  border:1.5px solid #D4E94C;animation:absp_pulse 1.8s ease-out infinite}
@keyframes absp_pulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(3);opacity:0}}
.ab-splash .s-lbl{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.10);backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.16);padding:4px 11px;border-radius:30px;
  font-size:11px;font-weight:600;color:#eaf1ff;white-space:nowrap}
.ab-splash .s-lbl small{font-size:9px;font-weight:700;letter-spacing:.08em;color:#D4E94C}
.ab-splash .s-tas{left:34px;top:486px;align-items:flex-start}
.ab-splash .s-ist{right:24px;top:414px;align-items:flex-end}

/* Brend */
.ab-splash .s-brand{position:absolute;left:0;right:0;bottom:60px;display:flex;flex-direction:column;align-items:center;gap:15px}
.ab-splash .s-logo{position:relative;width:60px;height:60px;border-radius:19px;
  background:linear-gradient(150deg,#2f5aa0,#16325c);display:flex;align-items:center;justify-content:center;
  box-shadow:0 16px 36px -10px rgba(47,90,160,.7),inset 0 1px 0 rgba(255,255,255,.3)}
.ab-splash .s-logo:before{content:"";position:absolute;inset:-9px;border-radius:26px;z-index:-1;
  background:radial-gradient(circle,rgba(212,233,76,.30),transparent 68%)}
.ab-splash .s-eyebrow{font-size:10px;font-weight:700;letter-spacing:.26em;color:#D4E94C;text-transform:uppercase}
.ab-splash .s-word{font-size:24px;font-weight:800;letter-spacing:-.02em;color:#fff;margin-top:-7px}
.ab-splash .s-word b{color:#cfe0ff;font-weight:800}
.ab-splash .s-sub{font-size:11px;color:#9fb2d4;margin-top:-9px}
.ab-splash .s-bar{margin-top:6px;width:120px;height:3px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
.ab-splash .s-bar i{display:block;height:100%;width:40%;border-radius:3px;
  background:linear-gradient(90deg,#2f5aa0,#D4E94C);animation:absp_load 1.5s ease-in-out infinite}
@keyframes absp_load{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}

/* Harakatni kamaytirish — statik sahna (samolyot/yulduz/bulut harakatsiz) */
.ab-splash.is-reduced .s-stars i,
.ab-splash.is-reduced .s-haze,
.ab-splash.is-reduced .s-trail,
.ab-splash.is-reduced .s-plane,
.ab-splash.is-reduced .s-pin.s-live:after,
.ab-splash.is-reduced .s-bar i{animation:none}
.ab-splash.is-reduced .s-plane{offset-distance:52%;opacity:1}
.ab-splash.is-reduced .s-trail{stroke-dashoffset:0;opacity:.55}
.ab-splash.is-reduced .s-pin.s-live:after{opacity:0}
.ab-splash.is-reduced .s-bar i{width:55%;transform:none}
`
