import { useEffect, useMemo, useRef, useState } from "react";
import GlassSurface from "./components/GlassSurface";

const donationTypes = [
  {
    code: "HC-SANG-204",
    type: "Sang total",
    hearts: 1,
    lives: 1,
    label: "Le plus classique, rapide et utile au quotidien."
  },
  {
    code: "HC-PLASMA-417",
    type: "Plasma",
    hearts: 2,
    lives: 2,
    label: "Très utile pour de nombreux traitements."
  },
  {
    code: "HC-PLAQ-318",
    type: "Plaquettes",
    hearts: 3,
    lives: 3,
    label: "Très demandées et précieuses."
  },
  {
    code: "HC-GR-126",
    type: "Globules rouges",
    hearts: 2,
    lives: 2,
    label: "Don ciblé pour des besoins précis."
  }
];

const MAX_HEARTS = 5;

function SurfaceCard({ children, className = "", height = "auto" }) {
  return (
    <GlassSurface
      width="100%"
      height={height}
      borderRadius={28}
      backgroundOpacity={0.2}
      saturation={1.4}
      blur={10}
      brightness={62}
      opacity={0.8}
      displace={0.45}
      distortionScale={-80}
      greenOffset={6}
      blueOffset={12}
      className={`surface-card ${className}`}
    >
      {children}
    </GlassSurface>
  );
}

function Modal({ open, title, onClose, children, variant = "liquid" }) {
  if (!open) {
    return null;
  }

  return (
    <div className="overlay" onClick={onClose}>
      {variant === "opaque" ? (
        <div className="modal-surface modal-surface--opaque" onClick={(event) => event.stopPropagation()}>
          <div className="modal-card">
            <div className="modal-header">
              <h2>{title}</h2>
              <button className="close-button" type="button" onClick={onClose}>
                Fermer
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : (
        <GlassSurface
          width="min(100%, 390px)"
          height="auto"
          borderRadius={28}
          backgroundOpacity={0.28}
          saturation={1.5}
          blur={12}
          displace={0.7}
          distortionScale={-100}
          className="modal-surface"
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{title}</h2>
              <button className="close-button" type="button" onClick={onClose}>
                Fermer
              </button>
            </div>
            {children}
          </div>
        </GlassSurface>
      )}
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [hearts, setHearts] = useState(2);
  const [status, setStatus] = useState("");
  const [speech, setSpeech] = useState("Coucou... j'attends mon prochain câlin de donneur.");
  const [detected, setDetected] = useState("Dernière photo reconnue : rien pour l'instant");
  const [captionTitle, setCaptionTitle] = useState("Ce que Miaou-Chi comprend des photos");
  const [captionText, setCaptionText] = useState("Quand tu scans le QR du centre, la photo permet de reconnaître le type de don et d'ajouter les bons coeurs.");
  const [scannerStatus, setScannerStatus] = useState("");
  const [saves, setSaves] = useState(0);
  const [scans, setScans] = useState(0);
  const [gamePoints, setGamePoints] = useState(0);
  const [highlightedType, setHighlightedType] = useState("");
  const [confetti, setConfetti] = useState([]);
  const [tapScore, setTapScore] = useState(0);
  const [breathCycles, setBreathCycles] = useState(0);
  const [breathWord, setBreathWord] = useState("Inspire");
  const [breathMessage, setBreathMessage] = useState("Prêt pour 3 respirations douces");
  const [gameTargets, setGameTargets] = useState([]);
  const [tapRunning, setTapRunning] = useState(false);
  const [breathRunning, setBreathRunning] = useState(false);

  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const qrIndexRef = useRef(0);
  const tapSpawnTimerRef = useRef(null);
  const tapStopTimerRef = useRef(null);
  const breathTimerRef = useRef(null);
  const targetCounterRef = useRef(0);
  const videoRef = useRef(null);

  const heartIcons = useMemo(
    () =>
      Array.from({ length: MAX_HEARTS }, (_, index) => (
        <span key={index} className={`heart-icon ${index < hearts ? "filled" : ""}`}>
          💖
        </span>
      )),
    [hearts]
  );

  useEffect(() => {
    return () => {
      stopCamera();
      clearTapTimers();
      clearBreathTimer();
    };
  }, []);

  function createConfetti() {
    const colors = ["#ff8fb1", "#ffd36e", "#93e7d8", "#ffb7d5", "#ffffff"];
    const pieces = Array.from({ length: 42 }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      left: Math.random() * 100,
      color: colors[index % colors.length],
      duration: 2.8 + Math.random() * 1.7,
      delay: Math.random() * 0.35,
      drift: Math.random() * 180 - 90
    }));

    setConfetti(pieces);
    window.setTimeout(() => setConfetti([]), 4200);
  }

  function stopCamera() {
    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("camera_unsupported");
    }

    return navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });
  }

  function getNextDonationType() {
    const sample = donationTypes[qrIndexRef.current % donationTypes.length];
    qrIndexRef.current += 1;
    return sample;
  }

  function finishScan() {
    const sample = getNextDonationType();

    stopCamera();
    setScannerOpen(false);
    setScannerStatus("");
    setHearts((current) => Math.min(MAX_HEARTS, current + sample.hearts));
    setSaves((current) => current + sample.lives);
    setScans((current) => current + 1);
    setHighlightedType(sample.type);
    setDetected(`Dernière photo reconnue : ${sample.type} • ${sample.code}`);
    setCaptionTitle(`Photo reconnue : ${sample.type}`);
    setCaptionText(`${sample.type} détecté, Miaou-Chi gagne +${sample.hearts} coeur${sample.hearts > 1 ? "s" : ""}.`);
    setSpeech(`Miaou ! Merci pour le ${sample.type.toLowerCase()}, je me sens déjà mieux.`);
    setStatus(`Merci ! ${sample.type} détecté, +${sample.hearts} coeur${sample.hearts > 1 ? "s" : ""}.`);
    createConfetti();
  }

  async function handleScan() {
    setStatus("");
    setScannerOpen(true);
    setScannerStatus("Ouverture de la caméra...");

    try {
      const stream = await startCamera();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setScannerStatus("Lecture du QR code et identification du type de don...");
      scanTimerRef.current = window.setTimeout(finishScan, 3000);
    } catch (error) {
      setScannerStatus("Caméra indisponible ici. Simulation douce en cours...");
      scanTimerRef.current = window.setTimeout(finishScan, 3000);
    }
  }

  function clearTapTimers() {
    if (tapSpawnTimerRef.current) {
      window.clearInterval(tapSpawnTimerRef.current);
      tapSpawnTimerRef.current = null;
    }

    if (tapStopTimerRef.current) {
      window.clearTimeout(tapStopTimerRef.current);
      tapStopTimerRef.current = null;
    }
  }

  function spawnTarget() {
    const id = ++targetCounterRef.current;
    const target = {
      id,
      left: 10 + Math.random() * 74,
      top: 8 + Math.random() * 68
    };

    setGameTargets((current) => [...current, target]);

    window.setTimeout(() => {
      setGameTargets((current) => current.filter((item) => item.id !== id));
    }, 850);
  }

  function startTapGame() {
    if (tapRunning) {
      return;
    }

    setTapRunning(true);
    setTapScore(0);
    setGameTargets([]);
    spawnTarget();
    tapSpawnTimerRef.current = window.setInterval(spawnTarget, 520);
    tapStopTimerRef.current = window.setTimeout(() => {
      clearTapTimers();
      setTapRunning(false);
      setGameTargets([]);
      setBreathMessage((current) =>
        current.includes("Bravo") ? current : `Mini-jeu fini, tu as gagné ${tapScore} point(s) douceur.`
      );
    }, 6500);
  }

  function catchTarget(targetId) {
    setGameTargets((current) => current.filter((item) => item.id !== targetId));
    setTapScore((current) => current + 1);
    setGamePoints((current) => current + 1);
  }

  function clearBreathTimer() {
    if (breathTimerRef.current) {
      window.clearInterval(breathTimerRef.current);
      breathTimerRef.current = null;
    }
  }

  function startBreathGame() {
    if (breathRunning) {
      return;
    }

    const phases = ["Inspire", "Bloque", "Expire"];
    let phaseIndex = 0;
    let cycles = 0;

    setBreathRunning(true);
    setBreathCycles(0);
    setBreathWord(phases[0]);
    setBreathMessage("Suis le rythme de Miaou-Chi");

    breathTimerRef.current = window.setInterval(() => {
      phaseIndex = (phaseIndex + 1) % phases.length;
      setBreathWord(phases[phaseIndex]);

      if (phaseIndex === 0) {
        cycles += 1;
        setBreathCycles(cycles);
        setGamePoints((current) => current + 2);
      }

      if (cycles >= 3) {
        clearBreathTimer();
        setBreathRunning(false);
        setBreathWord("Zen");
        setBreathMessage("Bravo, tu as terminé 3 respirations apaisantes.");
      }
    }, 1300);
  }

  return (
    <div className="app-shell">
      <div className="room-rug" aria-hidden="true" />
      <div className="sparkles" aria-hidden="true">
        <span>✦</span>
        <span>♡</span>
        <span>✿</span>
        <span>⋆</span>
      </div>
      <div className="floating-decor floating-syringe" aria-hidden="true">
        💉✨
      </div>
      <div className="floating-decor floating-heart" aria-hidden="true">
        🩸🐾
      </div>

      <div className="phone-frame">
        <header className="top-bar">
          <div className="brand">
            <div className="brand-badge">🐱</div>
            <div>
              <h1>HemoChi</h1>
              <p>Le don de sang en version douce</p>
            </div>
          </div>
          <button className="bubble-button" type="button" onClick={() => setMenuOpen(true)}>
            ☰
          </button>
        </header>

        <main className="content">
          <SurfaceCard className="hero-surface" height="auto">
            <section className="hero-card">
              <div className="life-hearts-card">
                <div className="life-hearts-label">
                  <span>Coeurs de vie</span>
                  <span>
                    {hearts} / {MAX_HEARTS}
                  </span>
                </div>
                <div className="heart-meter">{heartIcons}</div>
                <div className="heart-note">
                  Chaque type de don donne un nombre de coeurs différent à Miaou-Chi.
                </div>
              </div>

              <div className="speech-bubble">{speech}</div>

              <div className="pet-wrap">
                <div className="pet-shadow" />
                <div className={`pet ${status ? "celebrate" : ""}`}>
                  <div className="cat-ear left" />
                  <div className="cat-ear right" />
                  <div className="cat-head">
                    <div className="face">
                      <span className="eye eye-left" />
                      <span className="eye eye-right" />
                      <span className="blush blush-left" />
                      <span className="blush blush-right" />
                      <span className="nose" />
                      <span className="mouth" />
                      <span className="whisker left top" />
                      <span className="whisker left bottom" />
                      <span className="whisker right top" />
                      <span className="whisker right bottom" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pet-name">Miaou-Chi, ton petit compagnon courage</div>
              <p className={`status-message ${status ? "visible" : ""}`}>{status}</p>
              <div className="detected-chip">{detected}</div>

              <div className="companion-caption">
                <strong>{captionTitle}</strong>
                <span>{captionText}</span>
              </div>

              <button className="primary-button" type="button" onClick={handleScan}>
                📷 Nourris-le
              </button>

              <div className="stats-grid">
                <div className="stat-pill">
                  <strong>{saves}</strong>
                  <span>vies câlinées</span>
                </div>
                <div className="stat-pill">
                  <strong>{scans}</strong>
                  <span>photos QR</span>
                </div>
                <div className="stat-pill">
                  <strong>{gamePoints}</strong>
                  <span>points attente</span>
                </div>
              </div>
            </section>
          </SurfaceCard>

          <SurfaceCard className="info-surface" height="auto">
            <section className="info-card">
              <div className="section-heading">
                <h3>Le coeur de l'idée</h3>
                <span>compagnon first</span>
              </div>
              <p>
                HemoChi vit au centre de l&apos;expérience. Tout le reste passe au second plan: tu prends
                soin de lui, il te rassure pendant l&apos;attente, puis il grandit différemment selon le type
                de don réalisé.
              </p>
            </section>
          </SurfaceCard>
        </main>
      </div>

      {confetti.length > 0 && (
        <div className="confetti-layer" aria-hidden="true">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={{
                left: `${piece.left}vw`,
                background: piece.color,
                animationDuration: `${piece.duration}s`,
                animationDelay: `${piece.delay}s`,
                "--drift": `${piece.drift}px`
              }}
            />
          ))}
        </div>
      )}

      <Modal open={menuOpen} title="Menu" onClose={() => setMenuOpen(false)} variant="opaque">
        <div className="menu-grid">
          <button
            className="menu-action"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setGamesOpen(true);
            }}
          >
            <strong>Mini-jeux d&apos;attente</strong>
            <span>Des petites activités calmes et pop pour patienter avec Miaou-Chi.</span>
          </button>
          <button
            className="menu-action"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setJourneyOpen(true);
            }}
          >
            <strong>La démarche</strong>
            <span>Le déroulé du don, les types reconnus et combien de coeurs chacun apporte.</span>
          </button>
          <button
            className="menu-action"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setHelpOpen(true);
            }}
          >
            <strong>Le don de sang</strong>
            <span>Une explication simple et rassurante du parcours au centre.</span>
          </button>
        </div>
      </Modal>

      <Modal
        open={helpOpen}
        title="Comment se passe un don de sang ?"
        onClose={() => setHelpOpen(false)}
        variant="opaque"
      >
        <div className="help-steps">
          <div className="help-step">
            <strong>1. Accueil et petit questionnaire</strong>
            <span>On vérifie que tu peux donner aujourd&apos;hui et on répond à tes questions.</span>
          </div>
          <div className="help-step">
            <strong>2. Entretien et installation</strong>
            <span>Un professionnel t&apos;accompagne, t&apos;explique le geste et t&apos;installe confortablement.</span>
          </div>
          <div className="help-step">
            <strong>3. Le prélèvement</strong>
            <span>Le don dure quelques minutes pour le sang total, un peu plus selon le type de don.</span>
          </div>
          <div className="help-step">
            <strong>4. Pause et collation</strong>
            <span>Après le don, tu te reposes, puis HemoChi est nourri via le QR code du centre.</span>
          </div>
        </div>
      </Modal>

      <Modal
        open={gamesOpen}
        title="Mini-jeux de salle d'attente"
        onClose={() => setGamesOpen(false)}
        variant="opaque"
      >
        <div className="waiting-grid">
          <div className="game-card">
            <div className="game-header">
              <div>
                <h4>Attrape les coeurs</h4>
                <p>Tape les coeurs pop avant qu&apos;ils disparaissent.</p>
              </div>
              <div className="game-badge">+ énergie</div>
            </div>
            <div className="tap-game-area">
              {gameTargets.map((target) => (
                <button
                  key={target.id}
                  className="tap-target"
                  type="button"
                  style={{ left: `${target.left}%`, top: `${target.top}%` }}
                  onClick={() => catchTarget(target.id)}
                >
                  ♡
                </button>
              ))}
            </div>
            <div className="game-actions">
              <span>Score : {tapScore}</span>
              <button className="game-button" type="button" onClick={startTapGame} disabled={tapRunning}>
                {tapRunning ? "En cours..." : "Lancer"}
              </button>
            </div>
          </div>

          <div className="game-card">
            <div className="game-header">
              <div>
                <h4>Respire avec Miaou-Chi</h4>
                <p>Une mini pause guidée pour te relaxer avant le don.</p>
              </div>
              <div className="game-badge">+ calme</div>
            </div>
            <div className="breath-orb">{breathWord}</div>
            <div className="breath-text">{breathMessage}</div>
            <div className="game-actions">
              <span>Cycles : {breathCycles}</span>
              <button className="game-button" type="button" onClick={startBreathGame} disabled={breathRunning}>
                {breathRunning ? "Respire..." : "Commencer"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={journeyOpen}
        title="La démarche"
        onClose={() => setJourneyOpen(false)}
        variant="opaque"
      >
        <p className="journey-copy">
          Après le don, le QR code du centre permet à HemoChi d&apos;identifier ce qui a été donné. Chaque
          type remplit la vie du compagnon avec un nombre de coeurs différent.
        </p>
        <div className="donation-list">
          {donationTypes.map((donation) => (
            <div
              key={donation.code}
              className={`donation-card ${highlightedType === donation.type ? "highlight" : ""}`}
            >
              <div className="donation-top">
                <div>
                  <h4 className="donation-title">{donation.type}</h4>
                  <div className="donation-mini">{donation.label}</div>
                </div>
                <div className="plus-pill">+{donation.hearts}</div>
              </div>
              <p className="donation-copy">
                Récompense compagnon: +{donation.hearts} coeur{donation.hearts > 1 ? "s" : ""}.
              </p>
              {highlightedType === donation.type && <div className="detected-note">QR détecté ici</div>}
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={scannerOpen} title="Nourrir HemoChi" onClose={() => {
        stopCamera();
        setScannerOpen(false);
      }} variant="opaque">
        <p className="journey-copy">
          Pointe le QR code du centre dans le cadre. Selon la photo reconnue, HemoChi saura si c&apos;est du
          plasma, des plaquettes, du sang total ou des globules rouges.
        </p>
        <div className="camera-wrap">
          <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />
          <div className="scan-frame">
            <div className="scan-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <p className="scanner-status">{scannerStatus}</p>
      </Modal>
    </div>
  );
}
