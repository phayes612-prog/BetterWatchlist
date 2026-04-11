type AuthPageOptions = {
  baseUrl: string;
};

export const renderAuthPage = ({ baseUrl }: AuthPageOptions): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BetterWatchlist</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07131a;
        --bg-2: #0d1b24;
        --card: rgba(16, 28, 38, 0.56);
        --card-strong: rgba(15, 26, 35, 0.78);
        --line: rgba(173, 216, 230, 0.12);
        --line-strong: rgba(173, 216, 230, 0.2);
        --text: #ecf5fb;
        --muted: #9bb0be;
        --accent: #58d6c3;
        --accent-2: #2f8fff;
        --ok: #56f09d;
        --warn: #ffb15f;
        --danger: #ff7c90;
        --shadow: 0 30px 120px rgba(0, 0, 0, 0.45);
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        min-height: 100%;
      }

      body {
        min-height: 100vh;
        font-family: "SF Pro Display", "Segoe UI", "Helvetica Neue", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at 15% 20%, rgba(47, 143, 255, 0.22), transparent 26%),
          radial-gradient(circle at 82% 18%, rgba(88, 214, 195, 0.18), transparent 24%),
          radial-gradient(circle at 50% 80%, rgba(88, 214, 195, 0.1), transparent 30%),
          linear-gradient(180deg, var(--bg) 0%, #050b10 100%);
        display: grid;
        place-items: center;
        padding: 28px;
      }

      .shell {
        width: min(920px, 100%);
        background: linear-gradient(180deg, rgba(17, 30, 40, 0.72), rgba(10, 18, 25, 0.74));
        border: 1px solid var(--line);
        border-radius: 32px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(28px) saturate(130%);
        overflow: hidden;
      }

      .hero {
        position: relative;
        padding: 36px 36px 28px;
        border-bottom: 1px solid var(--line);
        background:
          linear-gradient(135deg, rgba(88, 214, 195, 0.08), transparent 34%),
          linear-gradient(225deg, rgba(47, 143, 255, 0.08), transparent 30%);
      }

      .eyebrow {
        margin: 0 0 12px;
        color: #7fd7ff;
        font-size: 13px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        max-width: 760px;
        font-size: clamp(46px, 9vw, 88px);
        line-height: 0.92;
        letter-spacing: -0.04em;
        font-weight: 700;
      }

      .body {
        display: grid;
        gap: 18px;
        padding: 24px;
      }

      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 20px;
        backdrop-filter: blur(22px);
      }

      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 48px;
        padding: 0 16px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.04);
        color: var(--muted);
        font-size: 15px;
      }

      .status.ok {
        color: var(--text);
      }

      .status.error {
        color: #ffd7de;
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--warn);
        box-shadow: 0 0 18px rgba(255, 177, 95, 0.45);
      }

      .status.ok .dot {
        background: var(--ok);
        box-shadow: 0 0 18px rgba(86, 240, 157, 0.45);
      }

      .status.error .dot {
        background: var(--danger);
        box-shadow: 0 0 18px rgba(255, 124, 144, 0.45);
      }

      button,
      a.button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 14px 20px;
        font: inherit;
        font-weight: 600;
        color: var(--text);
        text-decoration: none;
        cursor: pointer;
        transition: transform 160ms ease, opacity 160ms ease, background 160ms ease, box-shadow 160ms ease;
      }

      button:hover,
      a.button:hover {
        transform: translateY(-1px);
      }

      button:disabled {
        cursor: default;
        transform: none;
        opacity: 0.46;
      }

      .primary {
        background: linear-gradient(135deg, rgba(31, 197, 177, 0.9), rgba(28, 116, 185, 0.92));
        box-shadow: 0 18px 40px rgba(47, 143, 255, 0.18);
      }

      .secondary {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .hidden {
        display: none;
      }

      .block-title {
        margin: 0 0 14px;
        font-size: 12px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #8ca5b5;
      }

      .field-grid {
        display: grid;
        gap: 14px;
      }

      .field {
        display: grid;
        gap: 8px;
      }

      .field label {
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #88a0af;
      }

      .field input,
      .mono {
        width: 100%;
        border: 1px solid var(--line-strong);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
        padding: 16px 18px;
        font-size: 18px;
        outline: none;
        backdrop-filter: blur(16px);
      }

      .field input::placeholder {
        color: #6f8593;
      }

      .mono {
        font-family: "SF Mono", "Menlo", monospace;
        word-break: break-word;
      }

      .code {
        font-size: clamp(28px, 5vw, 42px);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
      }

      .steps {
        display: grid;
        gap: 10px;
        color: var(--muted);
        font-size: 15px;
      }

      .step {
        padding-left: 18px;
        position: relative;
      }

      .step::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0.58em;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: rgba(127, 215, 255, 0.8);
      }

      .footer-note {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      @media (max-width: 720px) {
        body {
          padding: 16px;
        }

        .hero {
          padding: 24px 22px 20px;
        }

        .body {
          padding: 16px;
        }

        .card {
          border-radius: 22px;
          padding: 16px;
        }

        .controls {
          flex-direction: column;
          align-items: stretch;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">BetterWatchlist x Trakt</p>
        <h1>Authorize once. Install addon after.</h1>
      </section>

      <section class="body">
        <div id="setupPanel" class="card hidden">
          <p class="block-title">Developer Setup</p>
          <div class="field-grid">
            <div class="field">
              <label for="clientIdInput">Trakt Client ID</label>
              <input id="clientIdInput" type="text" placeholder="Paste your Trakt client_id" />
            </div>
            <div class="field">
              <label for="clientSecretInput">Trakt Client Secret</label>
              <input id="clientSecretInput" type="password" placeholder="Paste your Trakt client_secret" />
            </div>
            <div class="controls">
              <button id="saveConfigButton" class="primary">Save App Keys</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="controls">
            <button id="startButton" class="primary">Start Trakt Authorization</button>
            <button id="pollButton" class="secondary" disabled>Check Authorization</button>
            <div id="statusBox" class="status">
              <span class="dot"></span>
              <span id="statusText">Ready</span>
            </div>
          </div>
        </div>

        <div id="devicePanel" class="card hidden">
          <p class="block-title">Activate on Trakt</p>
          <div class="field-grid">
            <div class="field">
              <label>Open</label>
              <div class="mono"><a id="verificationLink" href="#" target="_blank" rel="noreferrer">https://trakt.tv/activate</a></div>
            </div>
            <div class="field">
              <label>User Code</label>
              <div id="userCode" class="mono code">-</div>
            </div>
            <div class="steps">
              <div class="step">Open Trakt activate page.</div>
              <div class="step">Enter the code.</div>
              <div class="step">Approve access.</div>
              <div class="step">Come back and press Check Authorization.</div>
            </div>
          </div>
        </div>

        <div id="manifestPanel" class="card hidden">
          <p class="block-title">Manifest URL</p>
          <div id="manifestUrl" class="mono">${baseUrl}/manifest.json</div>
          <p class="footer-note">Use this URL in Stremio: Addons -> Install from URL.</p>
          <div class="controls">
            <button id="copyManifestButton" class="primary">Copy Manifest</button>
          </div>
        </div>
      </section>
    </main>

    <script>
      const statusText = document.getElementById("statusText");
      const statusBox = document.getElementById("statusBox");
      const startButton = document.getElementById("startButton");
      const pollButton = document.getElementById("pollButton");
      const saveConfigButton = document.getElementById("saveConfigButton");
      const clientIdInput = document.getElementById("clientIdInput");
      const clientSecretInput = document.getElementById("clientSecretInput");
      const setupPanel = document.getElementById("setupPanel");
      const devicePanel = document.getElementById("devicePanel");
      const manifestPanel = document.getElementById("manifestPanel");
      const verificationLink = document.getElementById("verificationLink");
      const userCode = document.getElementById("userCode");
      const manifestUrl = document.getElementById("manifestUrl");
      const copyManifestButton = document.getElementById("copyManifestButton");

      const setStatus = (text, tone) => {
        statusText.textContent = text;
        statusBox.classList.remove("ok", "error");
        if (tone) {
          statusBox.classList.add(tone);
        }
      };

      const getSessionId = () => new URL(window.location.href).searchParams.get("sessionId") || "";

      const setSessionId = (sessionId) => {
        const url = new URL(window.location.href);
        if (sessionId) {
          url.searchParams.set("sessionId", sessionId);
        } else {
          url.searchParams.delete("sessionId");
        }
        window.history.replaceState({}, "", url.toString());
      };

      const resetAuthorizationUi = () => {
        setSessionId("");
        devicePanel.classList.add("hidden");
        manifestPanel.classList.add("hidden");
        pollButton.disabled = true;
        startButton.disabled = false;
      };

      const showAuthorized = (url, username) => {
        manifestUrl.textContent = url;
        manifestPanel.classList.remove("hidden");
        devicePanel.classList.add("hidden");
        pollButton.disabled = true;
        setStatus(username ? "Authorized for " + username : "Authorized", "ok");
      };

      copyManifestButton?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(manifestUrl.textContent || "");
          setStatus("Manifest copied", "ok");
        } catch (error) {
          setStatus("Failed to copy manifest", "error");
        }
      });

      const loadSetupStatus = async () => {
        const response = await fetch("/api/setup/status");
        const data = await response.json();

        if (!data.traktAppConfigured) {
          setupPanel.classList.remove("hidden");
          startButton.disabled = true;
          pollButton.disabled = true;
          setStatus("Save app keys first");
          return false;
        }

        setupPanel.classList.add("hidden");
        if (!getSessionId()) {
          startButton.disabled = false;
        }
        return true;
      };

      const loadStatus = async () => {
        const configured = await loadSetupStatus();
        if (!configured) {
          return;
        }

        const sessionId = getSessionId();
        if (!sessionId) {
          resetAuthorizationUi();
          setStatus("Ready");
          return;
        }

        const response = await fetch("/api/auth/status?sessionId=" + encodeURIComponent(sessionId));
        const data = await response.json();

        if (data.status === "authorized") {
          showAuthorized(data.manifestUrl, data.username);
          return;
        }

        if (data.status === "pending") {
          devicePanel.classList.remove("hidden");
          verificationLink.href = data.verificationUrl;
          verificationLink.textContent = data.verificationUrl;
          userCode.textContent = data.userCode;
          startButton.disabled = true;
          pollButton.disabled = false;
          manifestPanel.classList.add("hidden");
          setStatus("Waiting for Trakt approval");
          return;
        }

        resetAuthorizationUi();
        setStatus("Ready");
      };

      saveConfigButton?.addEventListener("click", async () => {
        saveConfigButton.disabled = true;
        setStatus("Saving app keys");

        try {
          const response = await fetch("/api/setup/trakt-app", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              clientId: clientIdInput.value,
              clientSecret: clientSecretInput.value
            })
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to save app keys");
          }

          clientSecretInput.value = "";
          await loadStatus();
        } catch (error) {
          setStatus(error.message || "Failed to save app keys", "error");
        } finally {
          saveConfigButton.disabled = false;
        }
      });

      startButton.addEventListener("click", async () => {
        startButton.disabled = true;
        setStatus("Requesting device code");

        try {
          const response = await fetch("/api/auth/start");
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to start authorization");
          }

          setSessionId(data.session_id);
          verificationLink.href = data.verification_url;
          verificationLink.textContent = data.verification_url;
          userCode.textContent = data.user_code;
          devicePanel.classList.remove("hidden");
          manifestPanel.classList.add("hidden");
          pollButton.disabled = false;
          setStatus("Enter code on Trakt");
        } catch (error) {
          setStatus(error.message || "Failed to start authorization", "error");
        } finally {
          startButton.disabled = false;
        }
      });

      pollButton.addEventListener("click", async () => {
        pollButton.disabled = true;
        setStatus("Checking authorization");

        try {
          const sessionId = getSessionId();
          if (!sessionId) {
            throw new Error("No auth session found. Start again.");
          }

          const response = await fetch("/api/auth/poll?sessionId=" + encodeURIComponent(sessionId));
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to check authorization");
          }

          if (data.status === "authorized") {
            showAuthorized(data.manifestUrl, data.username);
            return;
          }

          setStatus("Still waiting for approval");
          pollButton.disabled = false;
        } catch (error) {
          resetAuthorizationUi();
          setStatus(error.message || "Failed to check authorization", "error");
        }
      });

      loadStatus().catch((error) => {
        setStatus(error.message || "Failed to load page", "error");
      });
    </script>
  </body>
</html>`;
