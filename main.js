const dom = {
  helpButton: document.getElementById("helpButton"),
  helpModal: document.getElementById("helpModal"),
  closeHelpButton: document.getElementById("closeHelpButton"),
  tabButtons: Array.from(document.querySelectorAll(".tab-button")),
  panels: Array.from(document.querySelectorAll(".panel")),
  scanButton: document.getElementById("scanButton"),
  scannerModal: document.getElementById("scannerModal"),
  closeScannerButton: document.getElementById("closeScannerButton"),
  cameraFeed: document.getElementById("cameraFeed"),
  cameraFallback: document.getElementById("cameraFallback"),
  scannerStatus: document.getElementById("scannerStatus"),
  lifeFill: document.getElementById("lifeFill"),
  lifePercent: document.getElementById("lifePercent"),
  pet: document.getElementById("pet"),
  statusMessage: document.getElementById("statusMessage"),
  confettiLayer: document.getElementById("confettiLayer"),
  detectedChip: document.getElementById("detectedChip"),
  saveCount: document.getElementById("saveCount"),
  scanCount: document.getElementById("scanCount"),
  gamePoints: document.getElementById("gamePoints"),
  donationCards: Array.from(document.querySelectorAll(".donation-card")),
  startTapGame: document.getElementById("startTapGame"),
  tapGameArea: document.getElementById("tapGameArea"),
  tapGameScore: document.getElementById("tapGameScore"),
  startBreathGame: document.getElementById("startBreathGame"),
  breathOrb: document.getElementById("breathOrb"),
  breathText: document.getElementById("breathText"),
  breathCount: document.getElementById("breathCount")
};

const QR_SAMPLES = [
  { code: "HC-SANG-204", type: "Sang total", feed: 100, lives: 1 },
  { code: "HC-PLASMA-417", type: "Plasma", feed: 100, lives: 2 },
  { code: "HC-PLAQ-318", type: "Plaquettes", feed: 100, lives: 3 },
  { code: "HC-GR-126", type: "Globules rouges", feed: 100, lives: 2 }
];

const state = {
  currentStream: null,
  fakeScanTimer: null,
  qrIndex: 0,
  totalScans: 0,
  totalLives: 0,
  waitingPoints: 0,
  tapScore: 0,
  tapSpawnTimer: null,
  tapStopTimer: null,
  breathTimer: null,
  breathCycles: 0
};

const TAP_SPAWN_RATE = 520;
const TAP_TARGET_LIFETIME = 900;
const TAP_GAME_DURATION = 6500;
const BREATH_INTERVAL = 1300;
const SCAN_SIMULATION_DELAY = 3000;
const CONFETTI_COUNT = 42;

function setLife(percent) {
  dom.lifeFill.style.width = percent + "%";
  dom.lifePercent.textContent = percent + "%";
}

function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function showStatus(message) {
  dom.statusMessage.textContent = message;
  dom.statusMessage.classList.toggle("visible", Boolean(message));
}

function setScannerStatus(message) {
  dom.scannerStatus.textContent = message;
}

function updateCounters() {
  dom.saveCount.textContent = state.totalLives;
  dom.scanCount.textContent = state.totalScans;
  dom.gamePoints.textContent = state.waitingPoints;
}

function createConfetti() {
  const colors = ["#ff8fb1", "#ffd36e", "#93e7d8", "#ffb7d5", "#ffffff"];
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < CONFETTI_COUNT; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[index % colors.length];
    piece.style.animationDuration = 2.8 + Math.random() * 1.7 + "s";
    piece.style.animationDelay = Math.random() * 0.35 + "s";
    piece.style.setProperty("--drift", Math.random() * 180 - 90 + "px");
    fragment.appendChild(piece);
  }

  dom.confettiLayer.appendChild(fragment);

  window.setTimeout(() => {
    dom.confettiLayer.innerHTML = "";
  }, 4200);
}

function highlightDonationType(type) {
  dom.donationCards.forEach((card) => {
    const active = card.dataset.type === type;
    card.classList.toggle("highlight", active);

    const note = card.querySelector(".detected-note");
    if (note) {
      note.remove();
    }

    if (active) {
      const detected = document.createElement("div");
      detected.className = "detected-note";
      detected.textContent = "QR détecté ici";
      card.appendChild(detected);
    }
  });
}

function celebrateDonation(sample) {
  state.totalScans += 1;
  state.totalLives += sample.lives;
  updateCounters();
  setLife(sample.feed);
  dom.detectedChip.textContent = "Dernier don détecté : " + sample.type + " • " + sample.code;
  showStatus("Merci ! " + sample.type + " détecté, Miaou-Chi est rassasié.");
  highlightDonationType(sample.type);
  dom.pet.classList.remove("celebrate");
  void dom.pet.offsetWidth;
  dom.pet.classList.add("celebrate");
  createConfetti();
}

function resetScannerView() {
  dom.cameraFeed.classList.remove("hidden");
  dom.cameraFallback.classList.remove("visible");
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

function stopCamera() {
  if (state.fakeScanTimer) {
    window.clearTimeout(state.fakeScanTimer);
    state.fakeScanTimer = null;
  }

  if (state.currentStream) {
    state.currentStream.getTracks().forEach((track) => track.stop());
    state.currentStream = null;
  }

  dom.cameraFeed.srcObject = null;
  resetScannerView();
}

function closeScannerModal() {
  stopCamera();
  closeModal(dom.scannerModal);
  setScannerStatus("");
  dom.scanButton.disabled = false;
}

function getNextQrSample() {
  const sample = QR_SAMPLES[state.qrIndex % QR_SAMPLES.length];
  state.qrIndex += 1;
  return sample;
}

function finishScan() {
  const sample = getNextQrSample();
  closeScannerModal();
  celebrateDonation(sample);
  switchTab("compagnon");
}

function launchFakeScan(message) {
  resetScannerView();
  dom.cameraFeed.classList.add("hidden");
  dom.cameraFallback.classList.add("visible");
  openModal(dom.scannerModal);
  setScannerStatus(message);

  state.fakeScanTimer = window.setTimeout(() => {
    finishScan();
  }, SCAN_SIMULATION_DELAY);
}

async function handleScanClick() {
  dom.scanButton.disabled = true;
  setScannerStatus("Ouverture de la caméra...");
  showStatus("");
  resetScannerView();

  try {
    state.currentStream = await startCamera();
    dom.cameraFeed.srcObject = state.currentStream;
    openModal(dom.scannerModal);
    setScannerStatus("Lecture du QR code et identification du type de don...");

    state.fakeScanTimer = window.setTimeout(() => {
      finishScan();
    }, SCAN_SIMULATION_DELAY);
  } catch (error) {
    if (error && error.name === "NotAllowedError") {
      launchFakeScan("Caméra refusée. Passage en mode démo...");
    } else if (error && error.name === "NotFoundError") {
      launchFakeScan("Aucune caméra détectée. Mode démo en cours...");
    } else {
      launchFakeScan("Caméra indisponible ici. Simulation du scan...");
    }
  }
}

function switchTab(tabName) {
  dom.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  dom.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === "panel-" + tabName);
  });
}

function clearTapTargets() {
  dom.tapGameArea.innerHTML = "";
}

function spawnTapTarget() {
  const target = document.createElement("button");
  target.type = "button";
  target.className = "tap-target";
  target.textContent = "♡";
  target.style.left = Math.random() * 78 + "%";
  target.style.top = Math.random() * 72 + "%";

  target.addEventListener("click", () => {
    state.tapScore += 1;
    state.waitingPoints += 1;
    dom.tapGameScore.textContent = "Score : " + state.tapScore;
    updateCounters();
    target.remove();
  });

  dom.tapGameArea.appendChild(target);
  window.setTimeout(() => {
    target.remove();
  }, TAP_TARGET_LIFETIME);
}

function startTapMiniGame() {
  if (state.tapSpawnTimer || state.tapStopTimer) {
    return;
  }

  state.tapScore = 0;
  dom.tapGameScore.textContent = "Score : 0";
  clearTapTargets();
  dom.startTapGame.disabled = true;
  dom.startTapGame.textContent = "En cours...";

  spawnTapTarget();
  state.tapSpawnTimer = window.setInterval(spawnTapTarget, TAP_SPAWN_RATE);
  state.tapStopTimer = window.setTimeout(() => {
    window.clearInterval(state.tapSpawnTimer);
    state.tapSpawnTimer = null;
    state.tapStopTimer = null;
    clearTapTargets();
    dom.startTapGame.disabled = false;
    dom.startTapGame.textContent = "Relancer";
    dom.breathText.textContent = "Mini-jeu fini, tu as gagné " + state.tapScore + " point(s) douceur.";
  }, TAP_GAME_DURATION);
}

function startBreathMiniGame() {
  if (state.breathTimer) {
    return;
  }

  const phases = ["Inspire", "Bloque", "Expire"];
  let phaseIndex = 0;
  state.breathCycles = 0;
  dom.breathCount.textContent = "Cycles : 0";
  dom.breathText.textContent = "Suis le rythme de Miaou-Chi";
  dom.startBreathGame.disabled = true;
  dom.startBreathGame.textContent = "Respire...";
  dom.breathOrb.textContent = phases[0];

  state.breathTimer = window.setInterval(() => {
    phaseIndex = (phaseIndex + 1) % phases.length;
    dom.breathOrb.textContent = phases[phaseIndex];

    if (phaseIndex === 0) {
      state.breathCycles += 1;
      state.waitingPoints += 2;
      dom.breathCount.textContent = "Cycles : " + state.breathCycles;
      updateCounters();
    }

    if (state.breathCycles >= 3) {
      window.clearInterval(state.breathTimer);
      state.breathTimer = null;
      dom.startBreathGame.disabled = false;
      dom.startBreathGame.textContent = "Recommencer";
      dom.breathText.textContent = "Bravo, tu as terminé 3 respirations apaisantes.";
      dom.breathOrb.textContent = "Zen";
    }
  }, BREATH_INTERVAL);
}

dom.helpButton.addEventListener("click", () => openModal(dom.helpModal));
dom.closeHelpButton.addEventListener("click", () => closeModal(dom.helpModal));
dom.scanButton.addEventListener("click", handleScanClick);
dom.startTapGame.addEventListener("click", startTapMiniGame);
dom.startBreathGame.addEventListener("click", startBreathMiniGame);

dom.helpModal.addEventListener("click", (event) => {
  if (event.target === dom.helpModal) {
    closeModal(dom.helpModal);
  }
});

dom.closeScannerButton.addEventListener("click", closeScannerModal);

dom.scannerModal.addEventListener("click", (event) => {
  if (event.target === dom.scannerModal) {
    closeScannerModal();
  }
});

dom.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    switchTab(button.dataset.tab);
  });
});

dom.donationCards.forEach((card) => {
  const plusButton = card.querySelector(".plus-button");
  plusButton.addEventListener("click", () => {
    card.classList.toggle("expanded");
    plusButton.textContent = card.classList.contains("expanded") ? "−" : "+";
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (dom.helpModal.classList.contains("open")) {
    closeModal(dom.helpModal);
  }

  if (dom.scannerModal.classList.contains("open")) {
    closeScannerModal();
  }
});

updateCounters();
setLife(50);
