document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    applyTheme();
    setupBackground();
    setupAudio();
    setupSocials();
    connectLanyard();
}

function applyTheme() {
    const root = document.documentElement;
    if (config.theme.accentColor) {
        root.style.setProperty('--accent', config.theme.accentColor);
    }
    if (config.theme.textColor) {
        root.style.setProperty('--text-primary', config.theme.textColor);
    }
    document.title = "Loading...";
}

function setupBackground() {
    const container = document.getElementById('background-container');
    const { type, source } = config.background;

    if (!source) return;

    if (type === 'video') {
        const video = document.createElement('video');
        video.src = source;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        container.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = source;
        img.alt = "Background";
        container.appendChild(img);
    }
}

let audioCtx = null;
let bgMusic = null;
let isPlaying = false;

function setupAudio() {
    const playBtn = document.getElementById('play-pause-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const audioControl = document.getElementById('audio-control');
    const overlay = document.getElementById('enter-overlay');

    if (!config.audio.enabled || !config.audio.source) {
        if (overlay) {
            overlay.addEventListener('click', () => {
                overlay.classList.add('fade-out');
            });
        }
        return;
    }

    bgMusic = new Audio(config.audio.source);
    bgMusic.loop = true;
    bgMusic.volume = config.audio.initialVolume || 0.5;
    volumeSlider.value = bgMusic.volume;
    if (overlay) {
        overlay.addEventListener('click', () => {
            bgMusic.play().then(() => {
                isPlaying = true;
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                audioControl.classList.remove('hidden');
            }).catch(e => {
                console.error("Audio autoplay failed:", e);
                audioControl.classList.remove('hidden');
            });
            overlay.classList.add('fade-out');

            const video = document.querySelector('#background-container video');
            if (video) video.muted = true;
        });
    } else {
        audioControl.classList.remove('hidden');
    }

    playBtn.addEventListener('click', () => {
        if (isPlaying) {
            bgMusic.pause();
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
        } else {
            bgMusic.play().catch(e => console.error("Audio play failed:", e));
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';

            const video = document.querySelector('#background-container video');
            if (video) video.muted = true;
        }
        isPlaying = !isPlaying;
    });

    // Volume Control
    volumeSlider.addEventListener('input', (e) => {
        bgMusic.volume = e.target.value;
    });
}

function setupSocials() {
    const container = document.getElementById('socials');
    if (!config.socials || config.socials.length === 0) return;

    config.socials.forEach(social => {
        const a = document.createElement('a');
        a.href = social.url;
        a.target = "_blank";
        a.className = "social-link";
        a.innerHTML = `<i class="${social.icon}"></i>`;
        a.setAttribute('aria-label', social.name);
        container.appendChild(a);
    });
}

const LANYARD_WS = 'wss://api.lanyard.rest/socket';
let heartbeatInterval = null;

function connectLanyard() {
    const ws = new WebSocket(LANYARD_WS);

    ws.onopen = () => {
        console.log('Lanyard Connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { op, d, t } = data;

        if (op === 1) {
            heartbeatInterval = setInterval(() => {
                ws.send(JSON.stringify({ op: 3 }));
            }, d.heartbeat_interval);

            ws.send(JSON.stringify({
                op: 2,
                d: { subscribe_to_id: config.discordID }
            }));
        }

        if (op === 0) {
            if (t === 'INIT_STATE' || t === 'PRESENCE_UPDATE') {
                updatePresence(d);
            }
        }
    };

    ws.onclose = () => {
        console.log('Lanyard Disconnected');
        clearInterval(heartbeatInterval);
        // Reconnect after 3s
        setTimeout(connectLanyard, 3000);
    };

    ws.onerror = (error) => {
        console.error('Lanyard Error:', error);
        ws.close();
    };
}

function updatePresence(data) {
    let user = data;
    if (data[config.discordID]) {
        user = data[config.discordID];
    }
    const avatar = document.getElementById('avatar');
    const username = document.getElementById('username');
    const statusIndicator = document.getElementById('status-indicator');
    const customStatus = document.getElementById('custom-status');
    const activityContainer = document.getElementById('activity');
    const activityIcon = document.getElementById('activity-icon');
    const activityName = document.getElementById('activity-name');
    const activityState = document.getElementById('activity-state');
    const activityDetails = document.getElementById('activity-details-text');
    const profile = document.getElementById('profile');
    const loading = document.getElementById('loading');
    const badges = document.getElementById('badges');

    if (loading) loading.remove();
    profile.classList.remove('hidden');

    if (user.discord_user) {
        username.textContent = user.discord_user.display_name || user.discord_user.username;
        document.title = username.textContent;

        const avatarId = user.discord_user.avatar;
        const userId = user.discord_user.id;
        if (avatarId) {
            const ext = avatarId.startsWith('a_') ? 'gif' : 'png';
            avatar.src = `https://cdn.discordapp.com/avatars/${userId}/${avatarId}.${ext}`;
        } else {
            avatar.src = `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discord_user.discriminator) % 5}.png`;
        }
    }
    const status = user.discord_status || 'offline';
    statusIndicator.className = `status-indicator ${status}`;
    statusIndicator.title = status.charAt(0).toUpperCase() + status.slice(1);

    const activities = user.activities || [];

    const custom = activities.find(a => a.type === 4);
    if (custom && custom.state) {
        customStatus.textContent = custom.state;
    } else {
        customStatus.textContent = "";
    }

    const presence = activities.find(a => a.type !== 4);

    if (presence) {
        activityContainer.classList.remove('hidden');
        activityName.textContent = presence.name;
        activityState.textContent = presence.state || "";
        activityDetails.textContent = presence.details || "";

        // Icon
        if (presence.assets && presence.assets.large_image) {
            let iconUrl = presence.assets.large_image;
            if (iconUrl.startsWith('mp:')) {
                iconUrl = iconUrl.replace('mp:', 'https://media.discordapp.net/');
            } else if (iconUrl.startsWith('spotify:')) {
                iconUrl = `https://i.scdn.co/image/${iconUrl.replace('spotify:', '')}`;
            } else {
                iconUrl = `https://cdn.discordapp.com/app-assets/${presence.application_id}/${presence.assets.large_image}.png`;
            }
            activityIcon.src = iconUrl;
            activityIcon.classList.remove('hidden');
        } else {
            activityIcon.src = "https://cdn.discordapp.com/embed/avatars/0.png";
        }
    } else {
        activityContainer.classList.add('hidden');
    }
}
