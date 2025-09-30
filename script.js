document.addEventListener("DOMContentLoaded", () => {
  const BELEM = [-1.4558, -48.4902];
  let map, userMarker, routesLayer, markers = [];
  let currentFilter = "all";

  // Criar ou recuperar session_id do usuário
  let session_id = localStorage.getItem("session_id");
  if (!session_id) {
    session_id = crypto.randomUUID();
    localStorage.setItem("session_id", session_id);
  }

  const userIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });

  const poiIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  });

  const POIS = [
    { id: "veropeso", nome: "Mercado Ver-o-Peso", desc: "Um dos maiores mercados abertos da América Latina.", coords: [-1.4555, -48.5022], cat: "cultura" },
    { id: "mangal", nome: "Mangal das Garças", desc: "Parque ecológico com jardins, aves e mirante.", coords: [-1.4575, -48.4987], cat: "natureza" },
    { id: "forte", nome: "Forte do Presépio", desc: "Construção histórica de 1616.", coords: [-1.4567, -48.5032], cat: "historia" },
    { id: "estacao", nome: "Estação das Docas", desc: "Complexo turístico e gastronômico à beira do rio.", coords: [-1.4507, -48.5025], cat: "gastronomia" }
  ];

  // Inicializar mapa
  map = L.map("map").setView(BELEM, 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);

  // Adicionar POIs
  POIS.forEach(p => {
    const marker = L.marker(p.coords, { icon: poiIcon }).addTo(map)
      .bindPopup(`<b>${p.nome}</b><br>${p.desc}`);
    markers.push(marker);
  });

  // Renderizar POIs na lista
  function renderPOIs() {
    const q = document.getElementById("q").value.toLowerCase();
    const list = document.getElementById("list");
    list.innerHTML = "";

    POIS.filter(p => (currentFilter === "all" || p.cat === currentFilter) &&
                     (p.nome.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)))
       .forEach(p => {
      const el = document.createElement("div");
      el.className = "poi";
      el.innerHTML = `
        <div class="poi-title">${p.nome}</div>
        <div class="poi-desc">${p.desc}</div>
        <button data-action="show" data-id="${p.id}">Mostrar</button>
        <button data-action="route" data-id="${p.id}">Rota</button>
      `;
      list.appendChild(el);
    });
  }

  function focusPOI(p) {
    map.setView(p.coords, 16, { animate: true });
    const marker = markers.find(m => {
      const ll = m.getLatLng();
      return Math.abs(ll.lat - p.coords[0]) < 1e-6 && Math.abs(ll.lng - p.coords[1]) < 1e-6;
    });
    if (marker) marker.openPopup();
  }

  function routeToPOI(p) {
    if (!userMarker) { alert("Ative sua localização primeiro!"); return; }

    const from = userMarker.getLatLng();
    if (routesLayer) map.removeControl(routesLayer);

    routesLayer = L.Routing.control({
      waypoints: [L.latLng(from.lat, from.lng), L.latLng(p.coords[0], p.coords[1])],
      router: L.Routing.osrmv1({ serviceUrl: "https://router.project-osrm.org/route/v1" }),
      lineOptions: { addWaypoints: false, styles: [{ color: "red", weight: 4 }] },
      routeWhileDragging: false,
      show: false,
      addWaypoints: false
    }).addTo(map);

    routesLayer.on("routesfound", function(e) {
      const routes = e.routes;
      const container = document.querySelector(".routes-carousel");
      if (container) container.innerHTML = "";

      routes.forEach((r, idx) => {
        const card = document.createElement("div");
        card.className = "route-card";
        card.innerHTML = `
          <strong>Rota ${idx+1}</strong>
          <span>Duração: ${(r.summary.totalTime/60).toFixed(1)} min</span><br>
          <span>Distância: ${(r.summary.totalDistance/1000).toFixed(2)} km</span>
        `;
        card.addEventListener("click", () => {
          routesLayer.setWaypoints([L.latLng(from.lat, from.lng), L.latLng(p.coords[0], p.coords[1])]);
          routesLayer.spliceWaypoints(0,2,from,p.coords);
          routesLayer.route();
          focusPOI(p);
        });
        if (container) container.appendChild(card);
      });
    });

    focusPOI(p);
  }

  function locateUser() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (userMarker) map.removeLayer(userMarker);
          userMarker = L.marker([lat, lng], { icon: userIcon })
            .addTo(map)
            .bindPopup("Você está aqui")
            .openPopup();
          map.setView([lat, lng], 15);
        },
        (err) => { alert("Não foi possível obter localização: " + err.message); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else { alert("Geolocalização não suportada neste dispositivo."); }
  }

  // Eventos do sidebar
  document.getElementById("q").addEventListener("input", renderPOIs);
  document.getElementById("clear").addEventListener("click", () => { document.getElementById("q").value=''; renderPOIs(); });
  document.querySelectorAll(".chip").forEach(c => c.addEventListener("click", e => {
    document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
    e.currentTarget.classList.add("active");
    currentFilter = e.currentTarget.dataset.filter || "all";
    renderPOIs();
  }));
  document.getElementById("list").addEventListener("click", e => {
    const action = e.target.getAttribute("data-action");
    const id = e.target.getAttribute("data-id");
    if (!action || !id) return;
    const p = POIS.find(x => x.id===id);
    if (!p) return;
    if (action==="show") focusPOI(p);
    if (action==="route") routeToPOI(p);
  });

  // Botão de localização
  const locateBtn = document.createElement("button");
  locateBtn.innerText = "📍";
  locateBtn.className = "locate-btn";
  locateBtn.style.position = "absolute";
  locateBtn.style.top = "10px";
  locateBtn.style.right = "10px";
  locateBtn.style.zIndex = 1000;
  locateBtn.addEventListener("click", locateUser);
  document.querySelector(".map").appendChild(locateBtn);

  renderPOIs();

  // === CHAT AI ===
  const chatBtn = document.getElementById("chat-float-btn");
  const chatContainer = document.getElementById("chat-container");
  const chatBox = document.getElementById("chat-box");
  const chatInput = document.getElementById("chat-input");

  chatBtn.addEventListener("click", () => { chatContainer.classList.toggle("chat-open"); });

  async function enviarPergunta(pergunta) {
    try {
      const response = await fetch("https://gabrielpsouza.app.n8n.cloud/webhook-test/chat-belem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta, session_id })
      });
      const data = await response.json();
      return data.resposta || "Desculpe, não foi possível obter resposta.";
    } catch (err) {
      console.error("Erro ao enviar pergunta:", err);
      return "Desculpe, ocorreu um erro ao processar sua pergunta.";
    }
  }

  document.getElementById("chat-form").addEventListener("submit", async e => {
    e.preventDefault();
    const pergunta = chatInput.value.trim();
    if (!pergunta) return;

    // Mostrar pergunta do usuário
    const userMsg = document.createElement("div");
    userMsg.className = "chat-user";
    userMsg.textContent = pergunta;
    chatBox.appendChild(userMsg);

    chatInput.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    // Receber resposta do n8n
    const resposta = await enviarPergunta(pergunta);

    // Mostrar resposta do IA Agent
    const aiMsg = document.createElement("div");
    aiMsg.className = "chat-ai";
    aiMsg.textContent = resposta;
    chatBox.appendChild(aiMsg);

    chatBox.scrollTop = chatBox.scrollHeight;
  });
});
