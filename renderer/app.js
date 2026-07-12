const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
const state = {
  connected: false,
  streaming: false,
  testing: false,
  profile: "balanced",
  startTime: null,
  recording: { enabled: false, path: "" },
  video: {
    contrast: 1,
    brightness: 0,
    saturation: 1,
    sharpness: 0.35,
    zoom: 1,
    mirror: false,
    overlay: false,
    overlaySize: 88,
    overlayOpacity: 1,
    overlayPosition: "bottom-right",
  },
  selectedSource: null,
  overlaySources: [
    {
      id: "app-logo",
      name: "Logo Centauri Live",
      kind: "application",
      visible: true,
      x: 82,
      y: 78,
      width: 88,
      opacity: 1,
    },
    {
      id: "author-logo",
      name: "Logo ApeXploit",
      kind: "author",
      visible: false,
      x: 4,
      y: 78,
      width: 88,
      opacity: 1,
    },
  ],
  destinations: [
    {
      name: "YouTube",
      icon: "▶",
      server: "rtmp://a.rtmp.youtube.com/live2/",
      enabled: false,
      key: "",
      status: "idle",
    },
    {
      name: "Twitch",
      icon: "◈",
      server: "rtmp://live.twitch.tv/app/",
      enabled: false,
      key: "",
      status: "idle",
    },
    {
      name: "Facebook",
      icon: "f",
      server: "rtmps://live-api-s.facebook.com:443/rtmp/",
      enabled: false,
      key: "",
      status: "idle",
    },
    {
      name: "TikTok",
      icon: "♪",
      server: "",
      enabled: false,
      key: "",
      status: "idle",
    },
  ],
};
let timerInterval;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}
function camera() {
  return `http://${$("#printerIP").value.trim()}:3031/video`;
}
const statusLabel = {
  idle: "En attente",
  connecting: "Connexion",
  live: "En direct",
  reconnecting: "Reconnexion",
  error: "Erreur",
};
async function persistSecrets() {
  if ($("#rememberKeys")?.checked)
    await window.centauri.saveSecrets(state.destinations);
}
function renderDestinations() {
  $("#destinationList").innerHTML = state.destinations
    .map(
      (d, i) =>
        `<article class="destination"><div class="desthead"><div class="destname"><div class="platformIcon">${d.icon}</div><div>${d.name}<p>${d.enabled ? "Activée" : "Désactivée"}</p></div></div><span class="destStatus ${d.status}">${statusLabel[d.status] || d.status}</span><button class="switch ${d.enabled ? "on" : ""}" data-toggle="${i}"></button></div><div class="fields">${d.name === "TikTok" ? `<input data-server="${i}" placeholder="URL du serveur RTMP TikTok" value="${esc(d.server)}">` : `<small>${d.server}</small>`}<input type="password" data-key="${i}" placeholder="Clé de diffusion" value="${esc(d.key)}"></div></article>`,
    )
    .join("");
  $$("[data-toggle]").forEach(
    (b) =>
      (b.onclick = async () => {
        state.destinations[+b.dataset.toggle].enabled =
          !state.destinations[+b.dataset.toggle].enabled;
        await persistSecrets();
        renderDestinations();
        updateReady();
      }),
  );
  $$("[data-key]").forEach(
    (i) =>
      (i.onchange = async () => {
        state.destinations[+i.dataset.key].key = i.value;
        await persistSecrets();
        updateReady();
      }),
  );
  $$("[data-server]").forEach(
    (i) =>
      (i.onchange = async () => {
        state.destinations[+i.dataset.server].server = i.value;
        await persistSecrets();
        updateReady();
      }),
  );
  updateReady();
}
function updateReady() {
  const active = state.destinations.filter(
    (d) => d.enabled && d.key && d.server,
  ).length;
  const destinationStat = $("#statDest");
  if (destinationStat)
    destinationStat.textContent = `${active} active${active > 1 ? "s" : ""}`;
  const outputReady =
    active > 0 || (state.recording.enabled && state.recording.path);
  const ready = state.connected && outputReady;
  $("#streamBtn").disabled = !ready && !state.streaming;
  $("#testBtn").disabled = !state.connected || state.streaming;
  $("#readyDot").className = "dot " + (ready ? "ok" : "");
  $("#readyText").textContent = ready
    ? "Prêt à diffuser"
    : "Configuration requise";
  $("#readyDetail").textContent = !state.connected
    ? "Connectez une caméra"
    : !outputReady
      ? "Configurez une destination ou un enregistrement"
      : "Tous les contrôles sont validés";
}
async function connect() {
  const ip = $("#printerIP").value.trim();
  localStorage.setItem("printerIP", ip);
  $("#cameraLabel").textContent = "Test de la connexion…";
  const result = await window.centauri.probe(ip);
  state.connected = result.camera;
  if (result.camera) {
    const url = camera() + `?t=${Date.now()}`;
    $("#preview").src = url;
    $("#sceneCamera").src = url;
    $("#sceneEmpty").style.display = "none";
    $("#preview").classList.add("connected");
    $("#emptyPreview").style.display = "none";
    $("#cameraLabel").textContent = `Centauri Carbon · ${ip}:3031`;
    toast("Caméra connectée");
  } else {
    $("#preview").classList.remove("connected");
    $("#emptyPreview").style.display = "grid";
    $("#sceneEmpty").style.display = "grid";
    $("#cameraLabel").textContent = "Caméra inaccessible";
    toast("Connexion impossible");
  }
  updateReady();
  return result;
}
$("#connectBtn").onclick = connect;
$("#refreshPreview").onclick = () => {
  if (state.connected) $("#preview").src = camera() + `?t=${Date.now()}`;
};
$("#discoverBtn").onclick = async () => {
  const b = $("#discoverBtn");
  b.textContent = "Détection en cours…";
  b.disabled = true;
  const found = await window.centauri.discover();
  $("#devices").innerHTML = found.length
    ? found
        .map(
          (d) =>
            `<div class="device" data-ip="${d.ip}">Centauri Carbon — ${d.ip}</div>`,
        )
        .join("")
    : '<div class="device">Aucune imprimante trouvée</div>';
  $$("[data-ip]").forEach(
    (x) =>
      (x.onclick = () => {
        $("#printerIP").value = x.dataset.ip;
        connect();
      }),
  );
  b.textContent = "⌕ Détecter automatiquement";
  b.disabled = false;
  toast(`${found.length} imprimante(s) détectée(s)`);
};
$$(".profiles button").forEach(
  (b) =>
    (b.onclick = () => {
      $$(".profiles button").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      state.profile = b.dataset.profile;
      localStorage.setItem("profile", state.profile);
      $("#statProfile").textContent = b.querySelector("span").textContent;
    }),
);
$$("nav button").forEach(
  (b) =>
    (b.onclick = () => {
      $$("nav button,.page").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      $("#" + b.dataset.page).classList.add("active");
    }),
);
$("#recordToggle").onclick = () => {
  state.recording.enabled = !state.recording.enabled;
  $("#recordToggle").classList.toggle("on", state.recording.enabled);
  $("#recordToggle").setAttribute(
    "aria-pressed",
    String(state.recording.enabled),
  );
  updateReady();
  toast(
    state.recording.enabled
      ? "Enregistrement local activé"
      : "Enregistrement local désactivé",
  );
};
$("#chooseRecording").onclick = async () => {
  const folder = await window.centauri.chooseRecordingFolder();
  if (folder) {
    state.recording.path = folder;
    localStorage.setItem("recordingPath", folder);
    $("#recordingPath").textContent = folder;
    updateReady();
    toast("Dossier d’enregistrement sélectionné");
  }
};
const imageDefaults = {
  contrast: 1,
  brightness: 0,
  saturation: 1,
  sharpness: 0.35,
  zoom: 1,
};
function updatePreviewEffects() {
  const brightness = Math.max(0.1, 1 + Number(state.video.brightness));
  $("#preview").style.filter =
    `url(#previewSharpen) contrast(${state.video.contrast}) brightness(${brightness}) saturate(${state.video.saturation})`;
  $("#preview").style.transform =
    `scale(${state.video.zoom}) scaleX(${state.video.mirror ? -1 : 1})`;
  const a = Number(state.video.sharpness) * 0.22;
  $("#sharpenMatrix").setAttribute(
    "kernelMatrix",
    `0 ${-a} 0 ${-a} ${1 + 4 * a} ${-a} 0 ${-a} 0`,
  );
  const overlay = $("#previewOverlay");
  overlay.classList.toggle("visible", state.video.overlay);
  overlay.style.width = overlay.style.height = `${state.video.overlaySize}px`;
  overlay.style.opacity = state.video.overlayOpacity;
  overlay.style.left = state.video.overlayPosition.includes("left")
    ? "18px"
    : "auto";
  overlay.style.right = state.video.overlayPosition.includes("right")
    ? "18px"
    : "auto";
  overlay.style.top = state.video.overlayPosition.includes("top")
    ? "18px"
    : "auto";
  overlay.style.bottom = state.video.overlayPosition.includes("bottom")
    ? "18px"
    : "auto";
}
function syncImageControls() {
  Object.keys(imageDefaults).forEach((key) => {
    $("#" + key).value = state.video[key];
    $("#" + key + "Value").textContent = Number(state.video[key]).toFixed(2);
  });
  $("#mirrorToggle").classList.toggle("on", state.video.mirror);
  $("#overlayToggle").classList.toggle("on", state.video.overlay);
  $("#overlaySize").value = state.video.overlaySize;
  $("#overlaySizeValue").textContent = state.video.overlaySize;
  $("#overlayOpacity").value = state.video.overlayOpacity;
  $("#overlayOpacityValue").textContent = Number(
    state.video.overlayOpacity,
  ).toFixed(2);
  $("#overlayPosition").value = state.video.overlayPosition;
  updatePreviewEffects();
}
Object.keys(imageDefaults).forEach((key) => {
  $("#" + key).oninput = (e) => {
    state.video[key] = Number(e.target.value);
    $("#" + key + "Value").textContent = state.video[key].toFixed(2);
    updatePreviewEffects();
    localStorage.setItem("videoSettings", JSON.stringify(state.video));
  };
});
$("#overlayToggle").onclick = () => {
  state.video.overlay = !state.video.overlay;
  $("#overlayToggle").classList.toggle("on", state.video.overlay);
  updatePreviewEffects();
  localStorage.setItem("videoSettings", JSON.stringify(state.video));
  toast(
    state.video.overlay
      ? "Overlay ApeXploit activé"
      : "Overlay ApeXploit désactivé",
  );
};
$("#mirrorToggle").onclick = () => {
  state.video.mirror = !state.video.mirror;
  $("#mirrorToggle").classList.toggle("on", state.video.mirror);
  updatePreviewEffects();
  localStorage.setItem("videoSettings", JSON.stringify(state.video));
};
["overlaySize", "overlayOpacity"].forEach((key) => {
  $("#" + key).oninput = (e) => {
    state.video[key] = Number(e.target.value);
    $("#" + key + "Value").textContent =
      key === "overlaySize" ? state.video[key] : state.video[key].toFixed(2);
    updatePreviewEffects();
    localStorage.setItem("videoSettings", JSON.stringify(state.video));
  };
});
$("#overlayPosition").onchange = (e) => {
  state.video.overlayPosition = e.target.value;
  updatePreviewEffects();
  localStorage.setItem("videoSettings", JSON.stringify(state.video));
};
const showOriginal = () => {
    $("#preview").style.filter = "none";
    $("#preview").style.transform = "none";
    $("#previewOverlay").classList.remove("visible");
  },
  showAdjusted = () => updatePreviewEffects();
$("#compareImage").onmousedown = showOriginal;
$("#compareImage").onmouseup = showAdjusted;
$("#compareImage").onmouseleave = showAdjusted;
$("#resetImage").onclick = () => {
  Object.assign(state.video, imageDefaults);
  syncImageControls();
  localStorage.setItem("videoSettings", JSON.stringify(state.video));
  toast("Réglages d’image réinitialisés");
};
$("#streamBtn").onclick = async () => {
  if (state.streaming) {
    await window.centauri.stop();
    return;
  }
  const result = await window.centauri.start({
    camera: camera(),
    profile: state.profile,
    destinations: state.destinations,
    recording: state.recording,
    video: state.video,
    overlaySources: state.overlaySources,
  });
  if (!result.ok) return toast(result.error);
  setStreaming(true);
};
$("#testBtn").onclick = async () => {
  if (state.streaming) return;
  state.testing = true;
  const result = await window.centauri.start({
    camera: camera(),
    profile: state.profile,
    destinations: [],
    recording: { enabled: false },
    video: state.video,
    overlaySources: state.overlaySources,
    testMode: true,
  });
  if (!result.ok) {
    state.testing = false;
    return toast(result.error);
  }
  setStreaming(true);
  $("#statState").textContent = "Test privé";
  $("#testBtn").textContent = "Test en cours…";
  setTimeout(async () => {
    if (state.testing) {
      state.testing = false;
      await window.centauri.stop();
      $("#testBtn").textContent = "Test privé 10 s";
      toast("Test privé terminé avec succès");
    }
  }, 10000);
};
function setStreaming(on) {
  state.streaming = on;
  $("#streamBtn").textContent = on ? "Arrêter le live" : "Démarrer le live";
  $("#streamBtn").classList.toggle("stop", on);
  $("#liveBadge").innerHTML = on
    ? '<span class="dot live"></span>EN DIRECT'
    : '<span class="dot"></span>HORS LIGNE';
  $("#statState").textContent = on ? "En direct" : "En attente";
  if (on) {
    state.startTime = Date.now();
    timerInterval = setInterval(() => {
      const s = Math.floor((Date.now() - state.startTime) / 1000);
      $("#timer").textContent = new Date(s * 1000).toISOString().slice(11, 19);
    }, 1000);
  } else {
    clearInterval(timerInterval);
    $("#timer").textContent = "00:00:00";
    $("#statEncoding").textContent = "— / —";
    $("#statSpeed").textContent = "—";
  }
  updateReady();
}
window.centauri.onEnded((code) => {
  state.testing = false;
  $("#testBtn").textContent = "Test privé 10 s";
  setStreaming(false);
  toast(
    code === 0 ? "Diffusion arrêtée" : `Diffusion interrompue (code ${code})`,
  );
});
window.centauri.onDestinationState(({ name, status }) => {
  const d = state.destinations.find((x) => x.name === name);
  if (d) {
    d.status = status;
    renderDestinations();
  }
});
window.centauri.onReconnecting(({ attempt, delay }) => {
  state.streaming = true;
  $("#statState").textContent = `Reconnexion ${attempt}/5`;
  $("#liveBadge").innerHTML = '<span class="dot"></span>RECONNEXION';
  toast(
    `Flux interrompu — nouvelle tentative dans ${Math.round(delay / 1000)} s`,
  );
});
window.centauri.onReconnected(({ attempt }) => {
  if (attempt) {
    $("#statState").textContent = "En direct";
    $("#liveBadge").innerHTML = '<span class="dot live"></span>EN DIRECT';
    toast("Diffusion reconnectée automatiquement");
  }
});
window.centauri.onRecordingStarted((path) =>
  toast(`Enregistrement démarré : ${path.split(/[\\/]/).pop()}`),
);
window.centauri.onStats(({ fps, bitrate, speed }) => {
  const targets = {
    economy: "1,8 Mb/s cible",
    balanced: "3,5 Mb/s cible",
    studio: "5 Mb/s cible",
  };
  $("#statEncoding").textContent =
    `${fps} FPS / ${bitrate === "N/A" ? targets[state.profile] : bitrate}`;
  $("#statSpeed").textContent = speed;
});
let logs = "";
window.centauri.onLog((text) => {
  logs = (logs + text).slice(-20000);
  $("#diagLog").textContent = logs;
  $("#diagLog").scrollTop = $("#diagLog").scrollHeight;
});
$("#runDiag").onclick = async () => {
  const ip = $("#printerIP").value.trim(),
    p = await window.centauri.probe(ip),
    f = await window.centauri.ffmpegStatus();
  $("#diagLog").textContent =
    `Diagnostic Centauri Live\n\nImprimante : ${ip}\nCaméra (3031) : ${p.camera ? "OK" : "INACCESSIBLE"}\nContrôle (3030) : ${p.control ? "OK" : "INACCESSIBLE"}\nFFmpeg : ${f.installed ? "INSTALLÉ" : "ABSENT"}\nSystème : ${f.platform}\nFlux : http://${ip}:3031/video`;
};
$("#installFfmpeg").onclick = async () => {
  const b = $("#installFfmpeg"),
    p = $("#installProgress");
  b.disabled = true;
  b.textContent = "Installation en cours…";
  p.classList.add("active");
  $("#diagLog").textContent = "Préparation de l’installation de FFmpeg…\n";
  const result = await window.centauri.installFfmpeg();
  if (!result.ok) {
    b.disabled = false;
    b.textContent = "Installer FFmpeg automatiquement";
    p.classList.remove("active");
    toast(result.error);
  }
};
$$("[data-help]").forEach(
  (button) =>
    (button.onclick = () => window.centauri.openHelpLink(button.dataset.help)),
);
window.centauri.onInstallLog((text) => {
  const log = $("#diagLog");
  log.textContent = (log.textContent + text).slice(-20000);
  log.scrollTop = log.scrollHeight;
});
window.centauri.onInstallEnded(async (result) => {
  const b = $("#installFfmpeg"),
    p = $("#installProgress");
  p.classList.remove("active");
  b.disabled = false;
  b.textContent = result.ok ? "FFmpeg installé ✓" : "Réessayer l’installation";
  const status = await window.centauri.ffmpegStatus();
  $("#ffmpegDot").classList.toggle("ok", status.installed);
  $("#ffmpegText").textContent = status.installed
    ? "Installé et prêt"
    : "Installation requise";
  toast(
    result.ok
      ? "FFmpeg est installé et prêt"
      : `Échec de l’installation${result.code !== undefined ? " (code " + result.code + ")" : ""}`,
  );
});
window.centauri.ffmpegStatus().then((f) => {
  $("#ffmpegDot").classList.toggle("ok", f.installed);
  $("#ffmpegText").textContent = f.installed
    ? "Installé et prêt"
    : "Installation requise";
});
async function initialize() {
  try {
    const savedIP = localStorage.getItem("printerIP");
    if (savedIP) $("#printerIP").value = savedIP;
    const savedProfile = localStorage.getItem("profile") || "balanced";
    state.profile = savedProfile;
    $$(".profiles button").forEach((b) =>
      b.classList.toggle("selected", b.dataset.profile === savedProfile),
    );
    const profileButton = $(`.profiles button[data-profile="${savedProfile}"]`);
    if (profileButton)
      $("#statProfile").textContent =
        profileButton.querySelector("span").textContent;
    try {
      state.recording.path =
        localStorage.getItem("recordingPath") ||
        (await window.centauri.defaultRecordingFolder());
    } catch {
      state.recording.path = "";
    }
    $("#recordingPath").textContent =
      state.recording.path || "Choisissez un dossier";
    try {
      const secure = await window.centauri.secureStorageStatus();
      $("#rememberKeys").disabled = !secure.available;
      const saved = await window.centauri.loadSecrets();
      if (saved.ok && saved.destinations.length) {
        saved.destinations.forEach((s) => {
          const d = state.destinations.find((x) => x.name === s.name);
          if (d)
            Object.assign(d, {
              key: s.key || "",
              server: s.server || d.server,
              enabled: !!s.enabled,
            });
        });
        $("#rememberKeys").checked = true;
      }
    } catch {
      $("#rememberKeys").disabled = true;
    }
    $("#rememberKeys").onchange = async () => {
      if ($("#rememberKeys").checked) {
        await persistSecrets();
        toast("Clés enregistrées avec le chiffrement système");
      } else {
        await window.centauri.clearSecrets();
        toast("Clés enregistrées supprimées");
      }
    };
    renderDestinations();
    connect();
    initializeWizard();
  } catch (error) {
    console.error("Initialization error", error);
    toast("Initialisation partielle : certaines options sont indisponibles");
  }
}
function initializeWizard() {
  if (localStorage.getItem("onboardingDone")) return;
  const modal = $("#onboarding"),
    steps = [
      [
        "Bienvenue dans Centauri Live",
        "Configurons votre Centauri Carbon et le moteur vidéo en quelques instants.",
        "Commencer",
      ],
      [
        "Détection de l’imprimante",
        "Utilisez “Détecter automatiquement” pour retrouver la caméra même si son adresse IP change.",
        "Continuer",
      ],
      [
        "Prêt à diffuser",
        "Ajoutez une destination ou activez l’enregistrement local. Les clés peuvent être chiffrées par le système.",
        "Terminer",
      ],
    ];
  let step = 0;
  modal.classList.add("show");
  const paint = () => {
    $("#wizardStep").textContent = `ÉTAPE ${step + 1} SUR ${steps.length}`;
    $("#wizardTitle").textContent = steps[step][0];
    $("#wizardText").textContent = steps[step][1];
    $("#wizardNext").textContent = steps[step][2];
  };
  const finish = () => {
    localStorage.setItem("onboardingDone", "1");
    modal.classList.remove("show");
  };
  $("#wizardSkip").onclick = finish;
  $("#wizardNext").onclick = () => {
    if (step === 1) $("#discoverBtn").click();
    if (++step >= steps.length) finish();
    else paint();
  };
  paint();
}
function saveScene() {
  localStorage.setItem("overlaySources", JSON.stringify(state.overlaySources));
}
function sourceAsset(source) {
  return source.kind === "application"
    ? "assets/centauri-live-studio-logo.png"
    : "assets/apexploit-logo.png";
}
function selectSource(id) {
  state.selectedSource = id;
  renderOverlayEditor();
}
function renderOverlayEditor() {
  const canvas = $("#sceneCanvas");
  canvas.querySelectorAll(".sceneSource").forEach((x) => x.remove());
  state.overlaySources.forEach((source) => {
    const img = document.createElement("img");
    img.src = sourceAsset(source);
    img.className = `sceneSource ${source.visible ? "" : "hidden"} ${state.selectedSource === source.id ? "selected" : ""}`;
    img.dataset.id = source.id;
    img.style.left = `${source.x}%`;
    img.style.top = `${source.y}%`;
    img.style.width = `${source.width / 12.8}%`;
    img.style.opacity = source.opacity;
    img.onpointerdown = (e) => {
      state.selectedSource = source.id;
      canvas
        .querySelectorAll(".sceneSource")
        .forEach((node) => node.classList.toggle("selected", node === img));
      const rect = canvas.getBoundingClientRect();
      img.setPointerCapture(e.pointerId);
      img.onpointermove = (move) => {
        if (!img.hasPointerCapture(move.pointerId)) return;
        source.x = Math.max(
          0,
          Math.min(95, ((move.clientX - rect.left) / rect.width) * 100),
        );
        source.y = Math.max(
          0,
          Math.min(95, ((move.clientY - rect.top) / rect.height) * 100),
        );
        img.style.left = `${source.x}%`;
        img.style.top = `${source.y}%`;
      };
      img.onpointerup = () => {
        saveScene();
        renderOverlayEditor();
      };
    };
    canvas.appendChild(img);
  });
  $("#sourcesList").innerHTML = [...state.overlaySources]
    .reverse()
    .map(
      (source) =>
        `<div class="sourceRow ${state.selectedSource === source.id ? "selected" : ""}" data-source="${source.id}"><button data-eye="${source.id}">${source.visible ? "◉" : "○"}</button><span>${source.name}</span><button data-up="${source.id}">↑</button><button data-down="${source.id}">↓</button><button data-remove="${source.id}">×</button></div>`,
    )
    .join("");
  $$("[data-source]").forEach(
    (row) =>
      (row.onclick = (e) => {
        if (e.target.tagName !== "BUTTON") selectSource(row.dataset.source);
      }),
  );
  $$("[data-eye]").forEach(
    (b) =>
      (b.onclick = () => {
        const s = state.overlaySources.find((x) => x.id === b.dataset.eye);
        s.visible = !s.visible;
        saveScene();
        renderOverlayEditor();
      }),
  );
  const move = (id, delta) => {
    const i = state.overlaySources.findIndex((x) => x.id === id),
      j = Math.max(0, Math.min(state.overlaySources.length - 1, i + delta));
    if (i !== j)
      [state.overlaySources[i], state.overlaySources[j]] = [
        state.overlaySources[j],
        state.overlaySources[i],
      ];
    saveScene();
    renderOverlayEditor();
  };
  $$("[data-up]").forEach((b) => (b.onclick = () => move(b.dataset.up, 1)));
  $$("[data-down]").forEach(
    (b) => (b.onclick = () => move(b.dataset.down, -1)),
  );
  $$("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        state.overlaySources = state.overlaySources.filter(
          (x) => x.id !== b.dataset.remove,
        );
        state.selectedSource = null;
        saveScene();
        renderOverlayEditor();
      }),
  );
  const selected = state.overlaySources.find(
    (x) => x.id === state.selectedSource,
  );
  $("#sourceProperties").innerHTML = selected
    ? `<h3>${selected.name}</h3><label>Taille <b>${selected.width}px</b></label><input id="sourceWidth" type="range" min="40" max="300" step="4" value="${selected.width}"><label>Opacité <b>${Math.round(selected.opacity * 100)}%</b></label><input id="sourceOpacity" type="range" min="0.1" max="1" step="0.05" value="${selected.opacity}"><small>Position : ${Math.round(selected.x)}%, ${Math.round(selected.y)}%</small>`
    : "<p>Sélectionnez une source.</p>";
  if (selected) {
    $("#sourceWidth").oninput = (e) => {
      selected.width = Number(e.target.value);
      saveScene();
      renderOverlayEditor();
    };
    $("#sourceOpacity").oninput = (e) => {
      selected.opacity = Number(e.target.value);
      saveScene();
      renderOverlayEditor();
    };
  }
}
function addSceneSource(kind) {
  const existing = state.overlaySources.find((x) => x.kind === kind);
  if (existing) {
    existing.visible = true;
    state.selectedSource = existing.id;
  } else {
    const id = `${kind}-${Date.now()}`;
    state.overlaySources.push({
      id,
      name: kind === "application" ? "Logo Centauri Live" : "Logo ApeXploit",
      kind,
      visible: true,
      x: 75,
      y: 75,
      width: 88,
      opacity: 1,
    });
    state.selectedSource = id;
  }
  saveScene();
  renderOverlayEditor();
}
$("#addAppLogo").onclick = () => addSceneSource("application");
$("#addAuthorLogo").onclick = () => addSceneSource("author");
$("#resetScene").onclick = () => {
  state.overlaySources = [
    {
      id: "app-logo",
      name: "Logo Centauri Live",
      kind: "application",
      visible: true,
      x: 82,
      y: 78,
      width: 88,
      opacity: 1,
    },
    {
      id: "author-logo",
      name: "Logo ApeXploit",
      kind: "author",
      visible: false,
      x: 4,
      y: 78,
      width: 88,
      opacity: 1,
    },
  ];
  state.selectedSource = null;
  saveScene();
  renderOverlayEditor();
};
try {
  const savedScene = localStorage.getItem("overlaySources");
  if (savedScene) state.overlaySources = JSON.parse(savedScene);
} catch {}
renderOverlayEditor();
try {
  const savedVideo = localStorage.getItem("videoSettings");
  if (savedVideo) Object.assign(state.video, JSON.parse(savedVideo));
} catch {}
syncImageControls();
renderDestinations();
initialize();
