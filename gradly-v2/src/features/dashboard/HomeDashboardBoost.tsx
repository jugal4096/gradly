import { useEffect, useState } from "react";

type Props = {
  resultsCount: number;
  latestSgpa: number | null;
  onProgress: () => void;
};

function playTone(kind: "tap" | "success" = "tap") {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    const notes = kind === "success" ? [523.25, 659.25, 783.99] : [440, 587.33];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.075);
      gain.gain.setValueAtTime(0.0001, now + index * 0.075);
      gain.gain.exponentialRampToValueAtTime(kind === "success" ? 0.075 : 0.035, now + index * 0.075 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.075 + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.075);
      oscillator.stop(now + index * 0.075 + 0.17);
    });
    window.setTimeout(() => void context.close(), 650);
  } catch {
    // Audio is an optional enhancement; dashboard functionality never depends on it.
  }
}

export default function HomeDashboardBoost({ resultsCount, latestSgpa, onProgress }: Props) {
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem("gradly_home_sound") === "on"; } catch { return false; }
  });
  const xp = resultsCount * 250;
  const level = Math.floor(xp / 750) + 1;
  const levelProgress = (xp % 750) / 750 * 100;
  const achievements = [
    { title: "First steps", detail: "Save your first semester", unlocked: resultsCount >= 1, icon: "✦" },
    { title: "Momentum maker", detail: "Record 3 semesters", unlocked: resultsCount >= 3, icon: "⚡" },
    { title: "Academic explorer", detail: "Record 5 semesters", unlocked: resultsCount >= 5, icon: "🏆" },
  ];
  useEffect(() => {
    if (resultsCount > 0 && soundOn) playTone("success");
  // Play a short celebration only when a saved-result milestone changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(resultsCount / 3), soundOn]);
  useEffect(() => {
    if (!soundOn) return;
    const handleDashboardClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const action = event.target.closest(".gd-home-hero button, .gd-home-metric, .gd-focus-card, .gd-tool-card, .gd-boost-footer button");
      if (action && !action.classList.contains("gd-boost-sound")) playTone("tap");
    };
    document.addEventListener("click", handleDashboardClick);
    return () => document.removeEventListener("click", handleDashboardClick);
  }, [soundOn]);
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try { localStorage.setItem("gradly_home_sound", next ? "on" : "off"); } catch { /* optional preference */ }
    if (next) playTone("success");
  };
  return <section className="gd-home-boost" aria-label="Your Gradly game progress">
    <div className="gd-boost-main">
      <div className="gd-boost-topline"><span className="gd-boost-kicker">YOUR PROGRESS QUEST</span><button type="button" className="gd-boost-sound" aria-pressed={soundOn} onClick={toggleSound}><span aria-hidden="true">{soundOn ? "♫" : "♪"}</span> Sound {soundOn ? "on" : "off"}</button></div>
      <div className="gd-boost-level-row"><div className="gd-boost-level"><span>LEVEL</span><strong>{level}</strong></div><div className="gd-boost-xp"><strong>{xp.toLocaleString()}</strong><span>XP EARNED</span></div><div className="gd-boost-progress-copy"><strong>{Math.round(levelProgress)}% to level {level + 1}</strong><span>{750 - (xp % 750)} XP to your next level</span></div></div>
      <div className="gd-boost-track" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(levelProgress)}><i style={{ width: levelProgress + "%" }} /></div>
      <p className="gd-boost-note">{resultsCount ? "Every saved semester adds 250 XP. Keep building your academic story." : "Your first saved semester starts your progress quest. Ready when you are."}</p>
    </div>
    <div className="gd-boost-side">
      <div className="gd-boost-achievement-head"><span>ACHIEVEMENT SHELF</span><strong>{achievements.filter(item => item.unlocked).length}/{achievements.length} unlocked</strong></div>
      <div className="gd-boost-achievements">{achievements.map(item => <div className={"gd-boost-achievement" + (item.unlocked ? " unlocked" : "")} key={item.title}><span>{item.unlocked ? item.icon : "◇"}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><b>{item.unlocked ? "✓" : "LOCKED"}</b></div>)}</div>
      <div className="gd-boost-footer"><span>{latestSgpa === null ? "Your next win is waiting" : "Latest SGPA · " + latestSgpa.toFixed(3)}</span><button type="button" onClick={onProgress}>View progress <b>↗</b></button></div>
    </div>
  </section>;
}
