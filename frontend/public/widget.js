(function () {
  "use strict";

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var agentId   = script.getAttribute("data-agent-id");
  var apiKey    = script.getAttribute("data-api-key");
  var apiUrl    = (script.getAttribute("data-api-url") || (function () {
    // Derive origin from the script's own src so clients that omit data-api-url
    // still reach the right server (e.g. https://primeassist.siddharth.ai)
    var src = script.src || "";
    var m = src.match(/^(https?:\/\/[^\/]+)/);
    return m ? m[1] : "http://localhost:8000";
  }())).replace(/\/$/, "");
  // Pipe-separated suggested prompts, e.g. data-suggestions="How do I...?|What is your...?"
  var suggestionsAttr = script.getAttribute("data-suggestions") || "";

  if (!agentId || !apiKey) {
    console.warn("[PrimeAssist] data-agent-id and data-api-key are required");
    return;
  }

  var conversationId  = null;
  var sessionToken    = sessionStorage.getItem("pa_session_" + agentId) || null;
  // Proactively clear an expired stored token so we don't waste a round-trip
  var storedExpiry    = sessionStorage.getItem("pa_session_expires_" + agentId);
  if (storedExpiry && Date.now() >= new Date(storedExpiry).getTime()) {
    sessionToken = null;
    sessionStorage.removeItem("pa_session_" + agentId);
    sessionStorage.removeItem("pa_session_expires_" + agentId);
  }
  var pendingMessage  = null;
  var greeted         = false;
  var pendingFile     = null;
  var brandColor      = "#18181b";
  var firstMsgSent    = false;  // tracks whether suggestions should be hidden
  // Handoff polling: once the backend has flipped the conversation into
  // pending_handoff / in_progress, we poll /widget/messages to surface
  // replies from the human agent (SSE stream has ended by then).
  var handoffPollInterval = null;
  var lastMsgId           = null;
  // Throttle typing-signal requests during handoff
  var typingTimer         = null;
  // Heartbeat interval: re-sends is_typing=true every 10 s while visitor is actively typing
  // (keeps the 15 s backend TTL alive for long typing sessions)
  var visitorTypingHeartbeat = null;
  // Floating "agent is typing" indicator shown during handoff polling
  var agentTypingEl       = null;

  // ── UUID helper ───────────────────────────────────────────────────────────
  // Fresh v4 UUID for every Idempotency-Key header
  function generateUUID() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  var css = [
    // Toggle button
    "#pa-widget-btn{position:fixed;bottom:24px;right:24px;z-index:9999;width:56px;height:56px;border-radius:50%;background:#18181b;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.3);transition:transform 0.2s,background 0.2s}",
    "#pa-widget-btn:hover{background:#27272a;transform:scale(1.07)}",
    "#pa-widget-btn svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    // Minimized indicator — pulsing green dot on the floating button showing the chat is still active
    ".pa-minimized::after{content:'';position:absolute;top:4px;right:4px;width:10px;height:10px;background:#22c55e;border-radius:50%;border:2px solid #fff;animation:pa-pulse 2s infinite}",
    "@keyframes pa-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}",
    // Panel — open animation
    "#pa-widget-panel{position:fixed;bottom:92px;right:24px;z-index:9999;width:380px;height:560px;background:#fff;border:1px solid #e4e4e7;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.18);display:none;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;overflow:hidden}",
    "#pa-widget-panel.open{display:flex;animation:pa-panel-open 0.22s cubic-bezier(0.34,1.26,0.64,1)}",
    "@keyframes pa-panel-open{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}",
    // Header
    "#pa-panel-header{background:#18181b;color:#fff;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}",
    "#pa-panel-header button{background:none;border:none;color:#a1a1aa;cursor:pointer;font-size:20px;line-height:1;padding:2px 4px;border-radius:4px}",
    "#pa-panel-header button:hover{color:#fff;background:rgba(255,255,255,0.1)}",
    "#pa-header-left{display:flex;align-items:center;gap:9px;min-width:0}",
    "#pa-agent-name{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "#pa-agent-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;display:none;flex-shrink:0}",
    "#pa-agent-avatar.show{display:block}",
    ".pa-status-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;flex-shrink:0;box-shadow:0 0 0 2px rgba(34,197,94,0.3)}",
    // Messages area
    "#pa-messages-wrap{flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column}",
    "#pa-messages{flex:1;overflow-y:auto;padding:14px 12px 4px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}",
    "#pa-messages::-webkit-scrollbar{width:4px}",
    "#pa-messages::-webkit-scrollbar-thumb{background:#e4e4e7;border-radius:2px}",
    // Scroll-to-bottom button
    "#pa-scroll-btn{position:absolute;bottom:8px;right:12px;width:30px;height:30px;border-radius:50%;background:#fff;border:1px solid #e4e4e7;cursor:pointer;font-size:14px;display:none;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.12);z-index:5;color:#52525b;transition:opacity 0.15s}",
    "#pa-scroll-btn.show{display:flex}",
    "#pa-scroll-btn:hover{background:#f4f4f5}",
    // Suggested prompts
    "#pa-suggestions{padding:6px 12px 10px;display:flex;flex-direction:column;gap:6px}",
    ".pa-sugg-chip{background:#f4f4f5;border:1px solid #e4e4e7;border-radius:20px;padding:7px 14px;font-size:13px;cursor:pointer;text-align:left;color:#18181b;font-family:inherit;transition:background 0.15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".pa-sugg-chip:hover{background:#e4e4e7}",
    // Message wrapper
    ".pa-msg-wrap{display:flex;flex-direction:column;max-width:88%;animation:pa-msg-in 0.18s ease-out}",
    ".pa-msg-wrap.user{align-self:flex-end;align-items:flex-end}",
    ".pa-msg-wrap.assistant,.pa-msg-wrap.agent{align-self:flex-start;align-items:flex-start}",
    ".pa-msg-wrap.thinking{align-self:flex-start;align-items:flex-start}",
    // Icon row — wraps icon + message wrap for assistant/agent roles
    ".pa-msg-row{display:flex;align-items:flex-start;gap:8px;max-width:88%;animation:pa-msg-in 0.18s ease-out}",
    ".pa-msg-row.assistant,.pa-msg-row.agent{align-self:flex-start}",
    ".pa-msg-avatar{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}",
    ".pa-msg-avatar.bot{background:#f4f4f5}",
    ".pa-msg-avatar.human{background:#dbeafe}",
    ".pa-msg-avatar svg{width:14px;height:14px;display:block}",
    "@keyframes pa-msg-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}",
    // Bubbles
    ".pa-msg{padding:10px 14px;border-radius:16px;line-height:1.55;word-break:break-word}",
    ".pa-msg.user{background:#18181b;color:#fff;border-bottom-right-radius:4px;white-space:pre-wrap}",
    ".pa-msg.assistant{background:#f4f4f5;color:#18181b;border-bottom-left-radius:4px}",
    // Support agent bubble (human operator in handoff mode)
    ".pa-msg.agent{background:#2563eb;color:#fff;border-bottom-left-radius:4px}",
    ".pa-msg-label{font-size:10px;font-weight:600;color:#2563eb;margin-bottom:2px;letter-spacing:0.02em}",
    // System notices (handoff acknowledged, conversation resolved, etc)
    ".pa-msg-wrap.system{align-self:center;align-items:center;max-width:92%}",
    ".pa-msg.system{background:transparent;color:#71717a;font-size:12px;font-style:italic;text-align:center;padding:6px 12px;border:1px dashed #e4e4e7;border-radius:10px}",
    // Typing indicator
    ".pa-msg.thinking{background:#f4f4f5;padding:12px 16px;border-bottom-left-radius:4px}",
    ".pa-typing-dots{display:flex;gap:5px;align-items:center}",
    ".pa-typing-dots span{width:7px;height:7px;border-radius:50%;background:#a1a1aa;display:inline-block;animation:pa-bounce 1.3s infinite}",
    ".pa-typing-dots span:nth-child(2){animation-delay:0.18s}",
    ".pa-typing-dots span:nth-child(3){animation-delay:0.36s}",
    "@keyframes pa-bounce{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-5px);opacity:1}}",
    // Alternate typing indicator (non-streaming wait state)
    ".pa-typing{display:flex;gap:4px;padding:4px 0}",
    ".pa-typing span{width:6px;height:6px;background:currentColor;border-radius:50%;animation:pa-bounce-alt 1.2s infinite;opacity:0.4}",
    ".pa-typing span:nth-child(2){animation-delay:0.2s}",
    ".pa-typing span:nth-child(3){animation-delay:0.4s}",
    "@keyframes pa-bounce-alt{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}",
    // Timestamps
    ".pa-msg-time{font-size:10px;color:#a1a1aa;margin-top:3px;line-height:1}",
    ".pa-msg-wrap:hover .pa-msg-time{}",
    // Markdown inside assistant messages
    ".pa-msg.assistant,.pa-msg.agent{white-space:normal}",
    ".pa-msg.assistant p,.pa-msg.agent p{margin:0 0 8px}",
    ".pa-msg.assistant p:last-child,.pa-msg.agent p:last-child{margin-bottom:0}",
    ".pa-msg.assistant ul,.pa-msg.assistant ol{margin:0 0 8px;padding-left:20px}",
    ".pa-msg.assistant li{margin-bottom:3px}",
    ".pa-msg.assistant h1,.pa-msg.assistant h2,.pa-msg.assistant h3{margin:8px 0 4px;font-size:1em;font-weight:700}",
    ".pa-msg.assistant code{background:#e4e4e7;border-radius:4px;padding:1px 5px;font-family:ui-monospace,monospace;font-size:12px}",
    ".pa-msg.assistant pre{background:#18181b;color:#d4d4d8;border-radius:0 0 10px 10px;padding:12px 14px;overflow-x:auto;margin:0}",
    ".pa-msg.assistant pre code{background:none;padding:0;color:inherit;font-size:12px}",
    ".pa-msg.assistant table{border-collapse:collapse;width:100%;margin:6px 0;font-size:13px}",
    ".pa-msg.assistant th,.pa-msg.assistant td{border:1px solid #e4e4e7;padding:5px 8px;text-align:left}",
    ".pa-msg.assistant th{background:#f4f4f5;font-weight:600}",
    ".pa-msg.assistant a{color:#2563eb;text-decoration:underline}",
    ".pa-msg.assistant blockquote{border-left:3px solid #d4d4d8;margin:0 0 8px;padding-left:10px;color:#71717a}",
    ".pa-msg.assistant img{max-width:100%;border-radius:8px;margin:4px 0;display:block}",
    // Citation chips
    ".pa-citations{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}",
    ".pa-cite-chip{font-size:11px;background:#e4e4e7;color:#52525b;border-radius:20px;padding:3px 9px;cursor:pointer;border:none;font-family:inherit}",
    ".pa-cite-chip:hover{background:#d4d4d8}",
    ".pa-cite-expanded{background:#f9f9f9;border:1px solid #e4e4e7;border-radius:8px;padding:8px 10px;font-size:12px;color:#52525b;margin-top:3px;line-height:1.5;display:none;max-width:320px}",
    ".pa-cite-expanded.open{display:block}",
    // In-bubble file attachment chip (shown inside user message)
    ".pa-attached-file{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:10px;padding:8px 11px;margin-bottom:6px;max-width:260px}",
    ".pa-attached-file-icon{width:32px;height:32px;border-radius:6px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0}",
    ".pa-attached-file-icon svg{width:16px;height:16px;fill:none;stroke:rgba(255,255,255,0.9);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".pa-attached-file-info{min-width:0}",
    ".pa-attached-file-name{font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;display:block}",
    ".pa-attached-file-size{font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-top:1px}",
    // Meta bar (copy + feedback)
    ".pa-msg-meta{display:flex;gap:5px;margin-top:5px;opacity:0;transition:opacity 0.15s}",
    ".pa-msg-wrap:hover .pa-msg-meta{opacity:1}",
    ".pa-meta-btn{background:none;border:1px solid #e4e4e7;border-radius:5px;padding:2px 8px;font-size:11px;cursor:pointer;color:#71717a;font-family:inherit}",
    ".pa-meta-btn:hover{background:#f4f4f5;color:#18181b}",
    ".pa-meta-btn.active{color:#16a34a;border-color:#16a34a}",
    // File chip
    ".pa-file-chip{display:none;align-items:center;gap:6px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;padding:4px 10px;font-size:12px;color:#18181b;margin:0 12px 4px}",
    ".pa-file-chip.show{display:flex}",
    ".pa-file-chip-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}",
    ".pa-file-remove{background:none;border:none;cursor:pointer;color:#71717a;font-size:14px;line-height:1;padding:0 2px}",
    ".pa-file-remove:hover{color:#ef4444}",
    // Input area
    "#pa-input-area{border-top:1px solid #e4e4e7;padding:10px 12px;display:flex;gap:8px;align-items:flex-end;flex-shrink:0}",
    "#pa-upload-btn{background:none;border:1px solid #e4e4e7;border-radius:8px;padding:8px 10px;cursor:pointer;color:#71717a;display:flex;align-items:center;flex-shrink:0}",
    "#pa-upload-btn:hover{background:#f4f4f5;color:#18181b}",
    "#pa-upload-btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    "#pa-input{flex:1;border:1px solid #e4e4e7;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;resize:none;font-family:inherit;line-height:1.5;max-height:120px;overflow-y:auto;color:#18181b;background:#fff}",
    "#pa-input:focus{border-color:#18181b;box-shadow:0 0 0 3px rgba(24,24,27,0.07)}",
    "#pa-send{background:#18181b;color:#fff;border:none;border-radius:10px;padding:8px 16px;cursor:pointer;font-size:14px;font-weight:500;white-space:nowrap;flex-shrink:0;transition:opacity 0.15s}",
    "#pa-send:hover{opacity:0.85}",
    "#pa-send:disabled{opacity:0.4;cursor:not-allowed}",
    // Powered-by footer
    "#pa-powered{text-align:center;font-size:10px;color:#a1a1aa;padding:4px 0 6px;flex-shrink:0}",
    // Auth modal
    "#pa-auth-overlay{position:absolute;inset:0;z-index:100;background:rgba(0,0,0,0.45);display:none;align-items:center;justify-content:center}",
    "#pa-auth-overlay.open{display:flex}",
    "#pa-auth-modal{background:#fff;border-radius:12px;padding:22px;width:300px;box-shadow:0 8px 30px rgba(0,0,0,0.2)}",
    "#pa-auth-modal h3{margin:0 0 4px;font-size:15px;font-weight:600;color:#18181b}",
    "#pa-auth-modal p{margin:0 0 14px;font-size:13px;color:#71717a}",
    ".pa-auth-field{margin-bottom:10px}",
    ".pa-auth-field label{display:block;font-size:12px;font-weight:500;color:#18181b;margin-bottom:4px}",
    ".pa-auth-field input{width:100%;box-sizing:border-box;border:1px solid #e4e4e7;border-radius:7px;padding:8px 10px;font-size:13px;outline:none;font-family:inherit;color:#18181b;background:#fff}",
    ".pa-auth-field input:focus{border-color:#18181b}",
    ".pa-auth-actions{display:flex;gap:8px;margin-top:14px}",
    ".pa-auth-btn{flex:1;padding:8px;border:none;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit}",
    ".pa-auth-btn.primary{background:#18181b;color:#fff}",
    ".pa-auth-btn.primary:hover{opacity:0.85}",
    ".pa-auth-btn.secondary{background:#f4f4f5;color:#18181b;border:1px solid #e4e4e7}",
    ".pa-auth-error{color:#ef4444;font-size:12px;margin-top:6px;display:none}",
    // Code blocks with language header
    ".pa-code-block{margin:6px 0;border-radius:10px;overflow:hidden}",
    ".pa-code-header{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:#27272a;border-bottom:1px solid rgba(255,255,255,0.06)}",
    ".pa-code-header span{font-size:11px;color:#71717a;font-family:ui-monospace,monospace}",
    ".pa-code-copy{background:transparent;border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#a1a1aa;font-size:11px;padding:2px 8px;cursor:pointer;font-family:inherit;transition:all 0.15s;line-height:1.5}",
    ".pa-code-copy:hover{background:rgba(255,255,255,0.1);color:#fff;border-color:rgba(255,255,255,0.3)}",
    // Syntax tokens (dark theme)
    ".tok-kw{color:#c792ea}",
    ".tok-str{color:#c3e88d}",
    ".tok-num{color:#f78c6c}",
    ".tok-cmt{color:#546e7a;font-style:italic}",
    // Mobile: full-screen panel
    "@media(max-width:480px){#pa-widget-panel{right:0!important;bottom:0!important;left:0!important;width:100%!important;height:100%!important;border-radius:0!important;border:none!important}#pa-widget-btn{bottom:16px;right:16px}}",
  ].join("");

  // Shadow DOM host — isolates all widget CSS from the host page's stylesheet
  var host = document.createElement("div");
  host.id = "pa-widget-host";
  var shadow = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = css;
  shadow.appendChild(style);

  // ── DOM ───────────────────────────────────────────────────────────────────

  var btn = document.createElement("button");
  btn.id = "pa-widget-btn";
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  shadow.appendChild(btn);

  var panel = document.createElement("div");
  panel.id = "pa-widget-panel";
  panel.innerHTML = [
    '<div id="pa-panel-header">',
    '  <div id="pa-header-left">',
    '    <img id="pa-agent-avatar" src="" alt="">',
    '    <span id="pa-agent-name">Chat</span>',
    '    <span class="pa-status-dot"></span>',
    '  </div>',
    '  <div style="display:flex;gap:2px;flex-shrink:0">',
    '    <button id="pa-reset" aria-label="New conversation" title="New conversation"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg></button>',
    '    <button id="pa-minimize" aria-label="Minimize" title="Minimize">&minus;</button>',
    '  </div>',
    '</div>',
    '<div id="pa-messages-wrap">',
    '  <div id="pa-messages"></div>',
    '  <div id="pa-suggestions"></div>',
    '  <button id="pa-scroll-btn" aria-label="Scroll to bottom">&#8595;</button>',
    '</div>',
    '<div class="pa-file-chip" id="pa-file-chip">',
    '  <span>&#128206;</span>',
    '  <span class="pa-file-chip-name" id="pa-file-chip-name"></span>',
    '  <button class="pa-file-remove" id="pa-file-remove" aria-label="Remove file">&times;</button>',
    '</div>',
    '<div id="pa-input-area">',
    '  <button id="pa-upload-btn" aria-label="Attach file" title="Attach PDF or image">',
    '    <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    '  </button>',
    '  <input type="file" id="pa-file-input" accept=".pdf,image/*" style="display:none">',
    '  <textarea id="pa-input" rows="1" placeholder="Ask something..."></textarea>',
    '  <button id="pa-send">Send</button>',
    '</div>',
    '<div id="pa-powered">Powered by PrimeAssist</div>',
    '<div id="pa-auth-overlay">',
    '  <div id="pa-auth-modal">',
    '    <h3 id="pa-auth-title">Verify your identity</h3>',
    '    <p id="pa-auth-desc">Please provide the required information to continue.</p>',
    '    <div id="pa-auth-fields"></div>',
    '    <div id="pa-auth-step2" style="display:none">',
    '      <div class="pa-auth-field">',
    '        <label>Enter the 6-digit code</label>',
    '        <input type="text" id="pa-otp-input" maxlength="6" placeholder="000000" inputmode="numeric" autocomplete="one-time-code">',
    '      </div>',
    '    </div>',
    '    <div class="pa-auth-error" id="pa-auth-error"></div>',
    '    <div class="pa-auth-actions">',
    '      <button class="pa-auth-btn secondary" id="pa-auth-cancel">Cancel</button>',
    '      <button class="pa-auth-btn primary" id="pa-auth-submit">Continue</button>',
    '    </div>',
    '  </div>',
    '</div>',
  ].join("");
  shadow.appendChild(panel);
  document.body.appendChild(host);

  var messages     = shadow.getElementById("pa-messages");
  var suggestionsEl = shadow.getElementById("pa-suggestions");
  var scrollBtn    = shadow.getElementById("pa-scroll-btn");
  var input        = shadow.getElementById("pa-input");
  var sendBtn      = shadow.getElementById("pa-send");
  sendBtn.disabled = true; // nothing to send on init
  var agentNameEl  = shadow.getElementById("pa-agent-name");
  var authOverlay  = shadow.getElementById("pa-auth-overlay");
  var authTitle    = shadow.getElementById("pa-auth-title");
  var authDesc     = shadow.getElementById("pa-auth-desc");
  var authFields   = shadow.getElementById("pa-auth-fields");
  var authStep2    = shadow.getElementById("pa-auth-step2");
  var authError    = shadow.getElementById("pa-auth-error");
  var authSubmit   = shadow.getElementById("pa-auth-submit");
  var authCancel   = shadow.getElementById("pa-auth-cancel");
  var otpInput     = shadow.getElementById("pa-otp-input");
  var uploadBtn    = shadow.getElementById("pa-upload-btn");
  var fileInput    = shadow.getElementById("pa-file-input");
  var fileChip     = shadow.getElementById("pa-file-chip");
  var fileChipName = shadow.getElementById("pa-file-chip-name");
  var fileRemove   = shadow.getElementById("pa-file-remove");
  var resetBtn     = shadow.getElementById("pa-reset");
  var minimizeBtn  = shadow.getElementById("pa-minimize");

  // Widget display state — 'closed' | 'open' | 'minimized'
  // closed: panel hidden, no indicator (next open starts fresh greeting flow)
  // open: panel visible
  // minimized: panel hidden but conversation state preserved; pulsing dot on button
  var widgetState = "closed";

  // Streaming preference (read from widget_config.enable_streaming, default true)
  var streamingEnabled = true;

  // Auth state
  var currentAuthLevel  = null;
  var currentAuthFields = [];
  var otpRequestId      = null;
  var otpDeliveryTarget = null;

  // ── Markdown renderer (self-contained, no CDN) ────────────────────────────

  function renderMarkdown(md) {
    var stash = [];

    function esc(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function inlineFmt(s) {
      // Images before links (same syntax prefix)
      s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
      s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
      s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/\*([^\*\n]+)\*/g, "<em>$1</em>");
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return s;
    }

    // Stash fenced code blocks (capture language tag)
    md = md.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      var k = "\x00" + stash.length + "\x00";
      var trimmed = code.trim();
      var body = lang ? highlightCode(trimmed, lang) : esc(trimmed);
      var hdr = '<div class="pa-code-header">'
        + (lang ? '<span>' + esc(lang) + '</span>' : '<span></span>')
        + '<button class="pa-code-copy">Copy</button>'
        + '</div>';
      stash.push('<div class="pa-code-block">' + hdr + '<pre><code>' + body + '</code></pre></div>');
      return "\n\n" + k + "\n\n";
    });

    // Stash inline code
    md = md.replace(/`([^`\n]+)`/g, function (_, code) {
      var k = "\x00" + stash.length + "\x00";
      stash.push("<code>" + esc(code) + "</code>");
      return k;
    });

    var html = md.split(/\n{2,}/).map(function (block) {
      block = block.trim();
      if (!block) return "";

      if (/^\x00\d+\x00$/.test(block)) return stash[+block.slice(1, -1)];

      var lines = block.split("\n");
      var first = lines[0];

      var hm = first.match(/^(#{1,3})\s+(.*)/);
      if (hm) {
        var lvl = hm[1].length;
        return "<h" + lvl + ">" + inlineFmt(esc(hm[2])) + "</h" + lvl + ">";
      }

      if (/^(\-{3,}|\*{3,})$/.test(first.trim())) return "<hr>";

      if (first.startsWith(">")) {
        return "<blockquote>" + lines.map(function (l) {
          return inlineFmt(esc(l.replace(/^>\s?/, "")));
        }).join(" ") + "</blockquote>";
      }

      if (/^[-*+]\s/.test(first)) {
        return "<ul>" + lines.map(function (l) {
          var m = l.match(/^[-*+]\s+(.*)/);
          return m ? "<li>" + inlineFmt(esc(m[1])) + "</li>" : "";
        }).join("") + "</ul>";
      }

      if (/^\d+\.\s/.test(first)) {
        return "<ol>" + lines.map(function (l) {
          var m = l.match(/^\d+\.\s+(.*)/);
          return m ? "<li>" + inlineFmt(esc(m[1])) + "</li>" : "";
        }).join("") + "</ol>";
      }

      if (first.includes("|") && lines.length > 1 && /^[\s|:\-]+$/.test(lines[1])) {
        function splitRow(line) {
          return line.replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
        }
        var heads = splitRow(first);
        var tHead = "<thead><tr>" + heads.map(function (h) {
          return "<th>" + inlineFmt(esc(h)) + "</th>";
        }).join("") + "</tr></thead>";
        var tBody = "<tbody>" + lines.slice(2).filter(function (l) {
          return l.includes("|");
        }).map(function (l) {
          return "<tr>" + splitRow(l).map(function (c) {
            return "<td>" + inlineFmt(esc(c)) + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody>";
        return "<table>" + tHead + tBody + "</table>";
      }

      return "<p>" + lines.map(function (l) {
        return inlineFmt(esc(l));
      }).join("<br>") + "</p>";
    }).join("\n");

    html = html.replace(/\x00(\d+)\x00/g, function (_, i) { return stash[+i]; });
    return html;
  }

  // ── Syntax highlighter (self-contained, no CDN) ───────────────────────────

  function highlightCode(code, lang) {
    var stash = [];
    var s = code;
    var l = (lang || "").toLowerCase();

    // Stash a highlighted span; raw text inside is HTML-escaped
    function save(cls, raw) {
      var k = "\x01" + stash.length + "\x01";
      stash.push('<span class="' + cls + '">' + esc(raw) + "</span>");
      return k;
    }

    // Block comments /* ... */
    s = s.replace(/\/\*[\s\S]*?\*\//g, function (m) { return save("tok-cmt", m); });
    // Line comments // ...
    s = s.replace(/\/\/[^\n]*/g, function (m) { return save("tok-cmt", m); });
    // Hash comments: Python, bash, shell, ruby, yaml, R
    if (/^(py|python|sh|bash|shell|rb|ruby|yaml|yml|ps1?|r)$/.test(l)) {
      s = s.replace(/(^|[ \t])(#[^\n]*)/gm, function (m, pre, cmt) {
        return pre + save("tok-cmt", cmt);
      });
    }
    // SQL -- line comments
    if (l === "sql") {
      s = s.replace(/--[^\n]*/g, function (m) { return save("tok-cmt", m); });
    }

    // Strings: double, single, template literals
    s = s.replace(/"(?:[^"\\]|\\.)*"/g, function (m) { return save("tok-str", m); });
    s = s.replace(/'(?:[^'\\]|\\.)*'/g, function (m) { return save("tok-str", m); });
    s = s.replace(/`(?:[^`\\]|\\.)*`/g, function (m) { return save("tok-str", m); });

    // Numbers
    s = s.replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, function (m) {
      return save("tok-num", m);
    });

    // Keywords per language
    var kwMap = {
      js:         "function const let var return if else for while do switch case break continue class new this typeof instanceof void delete import export from default async await try catch finally throw true false null undefined",
      javascript: "function const let var return if else for while do switch case break continue class new this typeof instanceof void delete import export from default async await try catch finally throw true false null undefined",
      ts:         "function const let var return if else for while do switch case break continue class new this typeof instanceof void delete import export from default async await try catch finally throw true false null undefined type interface enum extends implements readonly abstract",
      typescript: "function const let var return if else for while do switch case break continue class new this typeof instanceof void delete import export from default async await try catch finally throw true false null undefined type interface enum extends implements readonly abstract",
      py:         "def class return if elif else for while import from as with try except finally raise pass break continue lambda yield None True False and or not in is async await",
      python:     "def class return if elif else for while import from as with try except finally raise pass break continue lambda yield None True False and or not in is async await",
      sh:         "if then else elif fi for do done while case esac function return in local export",
      bash:       "if then else elif fi for do done while case esac function return in local export",
      sql:        "SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER ON AND OR NOT IN IS NULL AS GROUP BY ORDER HAVING LIMIT OFFSET INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX DROP ALTER ADD COLUMN PRIMARY KEY FOREIGN REFERENCES DISTINCT COUNT SUM AVG MIN MAX WITH UNION",
      json:       "true false null",
      go:         "func var const type return if else for range switch case break continue defer go chan map struct interface import package make new len cap append delete panic recover",
      rust:       "fn let mut const return if else for while loop match use struct enum impl pub mod async await move ref where",
      java:       "class public private protected static final void return if else for while do new this super import package try catch finally throw throws null true false instanceof",
      cs:         "class public private protected static readonly void return if else for foreach while do new this base using namespace try catch finally throw null true false typeof is as",
      cpp:        "class public private protected virtual static const void return if else for while do new delete this namespace using try catch throw true false nullptr template typename",
      c:          "return if else for while do switch case break continue struct typedef void static const extern int char float double long short unsigned signed",
      php:        "function class return if elseif else for foreach while do switch case break continue new this public private protected static final abstract try catch finally throw null true false echo print",
      rb:         "def class module return if elsif else unless for while do end begin rescue raise nil true false and or not in",
      ruby:       "def class module return if elsif else unless for while do end begin rescue raise nil true false and or not in",
    };

    var kwStr = kwMap[l];
    if (kwStr) {
      var kws = kwStr.split(" ");
      var kwRe = new RegExp("\\b(" + kws.join("|") + ")\\b", "g");
      s = s.replace(kwRe, function (m) { return save("tok-kw", m); });
    }

    // Escape remaining raw text (stash markers are \x01digits\x01, safe from &<>)
    s = s.replace(/[&<>]/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;";
    });

    // Restore stash
    s = s.replace(/\x01(\d+)\x01/g, function (_, i) { return stash[+i]; });
    return s;
  }

  // ── Branding ──────────────────────────────────────────────────────────────

  function applyBranding(color) {
    brandColor = color || "#18181b";
    var s = shadow.getElementById("pa-brand-style");
    if (!s) {
      s = document.createElement("style");
      s.id = "pa-brand-style";
      shadow.appendChild(s);
    }
    s.textContent = [
      "#pa-widget-btn{background:" + brandColor + "}",
      "#pa-widget-btn:hover{background:" + brandColor + ";filter:brightness(0.88)}",
      "#pa-panel-header{background:" + brandColor + "}",
      "#pa-send{background:" + brandColor + "}",
      ".pa-msg.user{background:" + brandColor + "}",
      "#pa-input:focus{border-color:" + brandColor + ";box-shadow:0 0 0 3px " + brandColor + "22}",
      ".pa-auth-btn.primary{background:" + brandColor + "}",
    ].join("");
  }

  // ── Streaming message helpers ─────────────────────────────────────────────

  // Shared decoration logic used by addMessage and finalizeStreamMessage
  function _appendDecorations(wrap, content, role, citations, messageId, timestamp) {
    if (role === "assistant" && citations && citations.length) {
      var seen = {};
      citations.forEach(function (c) {
        // Deduplicate by filename first (handles same doc ingested multiple times),
        // then doc_id, then chunk_id as last resort
        var key = c.filename || c.doc_id || c.chunk_id;
        if (!seen[key] || (c.score || 0) > (seen[key].score || 0)) seen[key] = c;
      });
      var unique = Object.keys(seen).map(function (k) { return seen[k]; });

      var citeRow = document.createElement("div");
      citeRow.className = "pa-citations";
      unique.forEach(function (c) {
        var chip = document.createElement("button");
        chip.className = "pa-cite-chip";
        var label = c.filename || "Source";
        if (c.page_number) label += " p." + c.page_number;
        chip.innerHTML = "&#128206; " + escapeHtml(label);

        var expanded = document.createElement("div");
        expanded.className = "pa-cite-expanded";
        expanded.textContent = c.text_snippet || "";

        chip.addEventListener("click", function () { expanded.classList.toggle("open"); });
        citeRow.appendChild(chip);
        citeRow.appendChild(expanded);
      });
      wrap.appendChild(citeRow);
    }

    if (role === "assistant") {
      var meta = document.createElement("div");
      meta.className = "pa-msg-meta";

      var copyBtn = document.createElement("button");
      copyBtn.className = "pa-meta-btn";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(content).then(function () {
          copyBtn.textContent = "Copied!";
          copyBtn.classList.add("active");
          setTimeout(function () { copyBtn.textContent = "Copy"; copyBtn.classList.remove("active"); }, 1500);
        });
      });
      meta.appendChild(copyBtn);

      var currentRating     = null;
      var feedbackDone      = false;
      var thumbUp           = document.createElement("button");
      var thumbDown         = document.createElement("button");
      thumbUp.className     = "pa-meta-btn";
      thumbDown.className   = "pa-meta-btn";
      thumbUp.textContent   = "\uD83D\uDC4D";
      thumbDown.textContent = "\uD83D\uDC4E";
      meta.appendChild(thumbUp);
      meta.appendChild(thumbDown);
      wrap.appendChild(meta);

      var commentBox = document.createElement("div");
      commentBox.style.cssText = "display:none;margin-top:5px";
      var commentInput = document.createElement("textarea");
      commentInput.placeholder = "Add a comment (optional)";
      commentInput.rows = 2;
      commentInput.style.cssText = "width:100%;box-sizing:border-box;border:1px solid #e4e4e7;border-radius:6px;padding:5px 8px;font-size:11px;font-family:inherit;resize:none;outline:none;color:#18181b;background:#fff;line-height:1.4;display:block";
      var sendFbBtn = document.createElement("button");
      sendFbBtn.className = "pa-meta-btn";
      sendFbBtn.style.marginTop = "4px";
      sendFbBtn.textContent = "Send feedback";
      commentBox.appendChild(commentInput);
      commentBox.appendChild(sendFbBtn);
      wrap.appendChild(commentBox);

      var updateThumbState = function () {
        thumbUp.classList.toggle("active", currentRating === "thumbs_up");
        thumbDown.classList.toggle("active", currentRating === "thumbs_down");
        commentBox.style.display = currentRating ? "block" : "none";
      };

      thumbUp.addEventListener("click", function () {
        if (feedbackDone) return;
        currentRating = currentRating === "thumbs_up" ? null : "thumbs_up";
        updateThumbState();
      });
      thumbDown.addEventListener("click", function () {
        if (feedbackDone) return;
        currentRating = currentRating === "thumbs_down" ? null : "thumbs_down";
        updateThumbState();
      });
      sendFbBtn.addEventListener("click", function () {
        if (!currentRating || feedbackDone) return;
        feedbackDone = true;
        sendFbBtn.disabled = true;
        sendFbBtn.textContent = "Sent!";
        var comment = commentInput.value.trim() || null;
        fetch(apiUrl + "/widget/feedback?session_token=" + encodeURIComponent(sessionToken || ""), {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "ngrok-skip-browser-warning": "true" },
          body: JSON.stringify({ rating: currentRating, message_id: messageId || null, comment: comment }),
        }).catch(function () {});
        setTimeout(function () { commentBox.style.display = "none"; }, 800);
      });
    }

    var timeEl = document.createElement("span");
    timeEl.className = "pa-msg-time";
    timeEl.textContent = nowTime(timestamp);
    wrap.appendChild(timeEl);
  }

  var BOT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M9 13v2M15 13v2"/></svg>';
  var AGENT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>';

  function _makeAvatar(isAgent) {
    var d = document.createElement("div");
    d.className = "pa-msg-avatar " + (isAgent ? "human" : "bot");
    d.innerHTML = isAgent ? AGENT_SVG : BOT_SVG;
    return d;
  }

  function _wrapInRow(role, wrap) {
    var row = document.createElement("div");
    row.className = "pa-msg-row " + role;
    row.appendChild(_makeAvatar(role === "agent"));
    row.appendChild(wrap);
    return row;
  }

  // Create an empty assistant bubble for streaming; returns the wrap element
  function addStreamingMessage() {
    if (!firstMsgSent) {
      firstMsgSent = true;
      suggestionsEl.style.display = "none";
    }
    var wrap = document.createElement("div");
    wrap.className = "pa-msg-wrap assistant";
    var bubble = document.createElement("div");
    bubble.className = "pa-msg assistant";
    bubble.style.whiteSpace = "pre-wrap";
    wrap.appendChild(bubble);
    messages.appendChild(_wrapInRow("assistant", wrap));
    scrollToBottom(true);
    return wrap;
  }

  // Replace streaming text with rendered markdown, attach citations/meta/timestamp
  function finalizeStreamMessage(wrap, content, citations, messageId) {
    var bubble = wrap.querySelector(".pa-msg");
    if (bubble) {
      bubble.style.whiteSpace = "";
      bubble.innerHTML = renderMarkdown(content);
    }
    _appendDecorations(wrap, content, "assistant", citations || [], messageId);
    scrollToBottom(true);
  }

  // ── Message helpers ───────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function nowTime(date) {
    var d = date ? new Date(date) : new Date();
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function scrollToBottom(force) {
    var atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 60;
    if (force || atBottom) {
      messages.scrollTop = messages.scrollHeight;
    }
  }

  function addThinking() {
    var wrap = document.createElement("div");
    wrap.className = "pa-msg-wrap thinking";
    var bubble = document.createElement("div");
    bubble.className = "pa-msg thinking";
    bubble.innerHTML = '<div class="pa-typing-dots"><span></span><span></span><span></span></div>';
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    scrollToBottom(true);
    return wrap;
  }

  function addMessage(role, text, citations, messageId, timestamp, attachment) {
    if (!firstMsgSent && (role === "user" || role === "assistant")) {
      firstMsgSent = true;
      suggestionsEl.style.display = "none";
    }

    var wrap = document.createElement("div");
    wrap.className = "pa-msg-wrap " + role;

    var bubble = document.createElement("div");
    bubble.className = "pa-msg " + role;

    // Render in-bubble file chip for user messages with an attachment
    if (role === "user" && attachment) {
      var chipEl = document.createElement("div");
      chipEl.className = "pa-attached-file";
      var sizeStr = attachment.size < 1024 * 1024
        ? Math.round(attachment.size / 1024) + " KB"
        : (attachment.size / (1024 * 1024)).toFixed(1) + " MB";
      chipEl.innerHTML =
        '<div class="pa-attached-file-icon">'
        + '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
        + '</div>'
        + '<div class="pa-attached-file-info">'
        + '<span class="pa-attached-file-name">' + attachment.name.replace(/</g, "&lt;") + '</span>'
        + '<span class="pa-attached-file-size">' + sizeStr + '</span>'
        + '</div>';
      bubble.appendChild(chipEl);
    }

    if (role === "assistant" || role === "agent") {
      bubble.innerHTML = renderMarkdown(text);
    } else if (text) {
      var textNode = document.createTextNode(text);
      bubble.appendChild(textNode);
    }
    wrap.appendChild(bubble);

    _appendDecorations(wrap, text, role, citations || [], messageId, timestamp);

    // Assistant and agent get an avatar icon; user messages go directly
    if (role === "assistant" || role === "agent") {
      messages.appendChild(_wrapInRow(role, wrap));
    } else {
      messages.appendChild(wrap);
    }
    // Always force-scroll for incoming agent messages so the visitor sees the reply
    scrollToBottom(role === "agent");
    return wrap;
  }

  // ── Suggested prompts ─────────────────────────────────────────────────────

  function showSuggestions(list) {
    suggestionsEl.innerHTML = "";
    if (!list || !list.length) return;
    list.forEach(function (text) {
      var chip = document.createElement("button");
      chip.className = "pa-sugg-chip";
      chip.textContent = text;
      chip.addEventListener("click", function () {
        suggestionsEl.style.display = "none";
        input.value = text;
        sendMessage();
      });
      suggestionsEl.appendChild(chip);
    });
  }

  // ── UI state ──────────────────────────────────────────────────────────────

  function updateSendBtn() {
    sendBtn.disabled = !input.value.trim();
  }

  function setLoading(loading) {
    if (loading) {
      sendBtn.disabled  = true;
    } else {
      updateSendBtn();
    }
    input.disabled    = loading;
    uploadBtn.disabled = loading;
  }

  function resetConversation() {
    messages.innerHTML = "";
    conversationId = null;
    firstMsgSent   = false;
    pendingFile    = null;
    fileChip.classList.remove("show");
    fileChipName.textContent = "";
    suggestionsEl.innerHTML  = "";
    suggestionsEl.style.display = "";
    // Stop any active handoff polling — it's tied to the old conversation
    if (handoffPollInterval) {
      clearInterval(handoffPollInterval);
      handoffPollInterval = null;
    }
    if (agentTypingEl) { agentTypingEl.remove(); agentTypingEl = null; }
    lastMsgId = null;
    // Re-run init to show greeting + suggestions fresh
    greeted = false;
    // Clear session and expiry so POST /widget/init issues a fresh session on next init
    sessionToken = null;
    sessionStorage.removeItem("pa_session_" + agentId);
    sessionStorage.removeItem("pa_session_expires_" + agentId);
    applyWidgetConfig._cached = null;
    // If user reset while minimized, clear the indicator — conversation is gone
    if (widgetState === "minimized") btn.classList.remove("pa-minimized");
    initWidget();
  }

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.style.display = "block";
  }

  function hideAuthError() {
    authError.style.display = "none";
  }

  function closeAuthModal() {
    authOverlay.classList.remove("open");
    authFields.innerHTML = "";
    authStep2.style.display = "none";
    otpRequestId = null;
    otpDeliveryTarget = null;
    currentAuthLevel = null;
    currentAuthFields = [];
    hideAuthError();
    authSubmit.disabled = false;
    authSubmit.textContent = "Continue";
  }

  // ── Auth modal ────────────────────────────────────────────────────────────

  function showAuthModal(authLevel, fields, toolName) {
    currentAuthLevel  = authLevel;
    currentAuthFields = fields || [];
    authFields.innerHTML = "";
    authStep2.style.display = "none";
    hideAuthError();
    authSubmit.textContent = "Continue";
    authSubmit.disabled = false;

    if (authLevel === "basic_info") {
      authTitle.textContent = "Identity verification required";
      authDesc.textContent  = "Please provide the following information to access " + (toolName || "this feature") + ".";
      currentAuthFields.forEach(function (field) {
        var div = document.createElement("div");
        div.className = "pa-auth-field";
        var label = document.createElement("label");
        label.textContent = field.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        var inp = document.createElement("input");
        inp.type = "text";
        inp.name = field;
        inp.placeholder = field;
        div.appendChild(label);
        div.appendChild(inp);
        authFields.appendChild(div);
      });
    } else if (authLevel === "sms_otp" || authLevel === "email_otp") {
      var isPhone = authLevel === "sms_otp";
      authTitle.textContent = (isPhone ? "Phone" : "Email") + " verification required";
      authDesc.textContent  = "We'll send a verification code to your " + (isPhone ? "phone number" : "email address") + ".";
      var div = document.createElement("div");
      div.className = "pa-auth-field";
      var label = document.createElement("label");
      label.textContent = isPhone ? "Phone number" : "Email address";
      var inp = document.createElement("input");
      inp.type = isPhone ? "tel" : "email";
      inp.name = "target";
      inp.placeholder = isPhone ? "+1 555 000 0000" : "you@example.com";
      div.appendChild(label);
      div.appendChild(inp);
      authFields.appendChild(div);
    }

    authOverlay.classList.add("open");
  }

  async function handleAuthSubmit() {
    hideAuthError();
    authSubmit.disabled = true;
    authSubmit.textContent = "Please wait...";

    try {
      if (currentAuthLevel === "basic_info") {
        var fieldValues = {};
        authFields.querySelectorAll("input").forEach(function (inp) {
          fieldValues[inp.name] = inp.value.trim();
        });
        var resp = await fetch(apiUrl + "/widget/auth/verify-basic", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "ngrok-skip-browser-warning": "true" },
          body: JSON.stringify({ conversation_id: conversationId, fields: fieldValues }),
        });
        var data = await resp.json();
        if (!resp.ok) {
          showAuthError((data.detail && data.detail.message) || "Verification failed");
          authSubmit.disabled = false;
          authSubmit.textContent = "Continue";
          return;
        }
        sessionToken = data.session_token;
        sessionStorage.setItem("pa_session_" + agentId, sessionToken);
        closeAuthModal();
        if (pendingMessage) { var msg = pendingMessage; pendingMessage = null; await sendMessage(msg); }

      } else if ((currentAuthLevel === "sms_otp" || currentAuthLevel === "email_otp") && !otpRequestId) {
        var targetInput = authFields.querySelector("input[name='target']");
        var target = targetInput ? targetInput.value.trim() : "";
        if (!target) {
          showAuthError("Please enter your " + (currentAuthLevel === "sms_otp" ? "phone number" : "email"));
          authSubmit.disabled = false;
          authSubmit.textContent = "Continue";
          return;
        }
        otpDeliveryTarget = target;
        var resp = await fetch(apiUrl + "/widget/auth/request-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "ngrok-skip-browser-warning": "true" },
          body: JSON.stringify({
            conversation_id: conversationId,
            delivery_type: currentAuthLevel === "sms_otp" ? "sms" : "email",
            target: target,
          }),
        });
        var data = await resp.json();
        if (!resp.ok) {
          showAuthError((data.detail && data.detail.message) || "Failed to send code");
          authSubmit.disabled = false;
          authSubmit.textContent = "Continue";
          return;
        }
        otpRequestId = data.otp_request_id;
        authFields.innerHTML = "";
        authStep2.style.display = "block";
        authDesc.textContent = "A 6-digit code was sent. Enter it below.";
        authSubmit.textContent = "Verify";
        authSubmit.disabled = false;
        otpInput.value = "";
        otpInput.focus();

      } else if (otpRequestId) {
        var code = otpInput.value.trim();
        if (code.length !== 6) {
          showAuthError("Please enter the 6-digit code");
          authSubmit.disabled = false;
          authSubmit.textContent = "Verify";
          return;
        }
        var resp = await fetch(apiUrl + "/widget/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "ngrok-skip-browser-warning": "true" },
          body: JSON.stringify({ otp_request_id: otpRequestId, otp: code, conversation_id: conversationId }),
        });
        var data = await resp.json();
        if (!resp.ok) {
          showAuthError((data.detail && data.detail.message) || "Incorrect code");
          authSubmit.disabled = false;
          authSubmit.textContent = "Verify";
          return;
        }
        sessionToken = data.session_token;
        sessionStorage.setItem("pa_session_" + agentId, sessionToken);
        closeAuthModal();
        if (pendingMessage) { var msg = pendingMessage; pendingMessage = null; await sendMessage(msg); }
      }
    } catch (err) {
      showAuthError("Network error. Please try again.");
      authSubmit.disabled = false;
      authSubmit.textContent = "Continue";
    }
  }

  // ── Handoff polling ───────────────────────────────────────────────────────

  // Poll /widget/messages for new agent replies after the AI has handed off
  // to a human. Stops automatically when the conversation is resolved.
  function startHandoffPolling(convId, afterId) {
    if (handoffPollInterval) clearInterval(handoffPollInterval);
    lastMsgId = afterId || lastMsgId;
    // Client-side dedup: track IDs already rendered so repeated full-history
    // responses from the backend don't cause duplicate bubbles.
    var renderedIds = new Set();
    // On the first poll the backend returns the full history including messages
    // already shown by SSE. Bootstrap by marking everything as seen without
    // rendering — from the second poll onward only genuinely new items appear.
    var firstPoll = true;
    handoffPollInterval = setInterval(async function () {
      try {
        // First poll: full history (no after_id) for bootstrap.
        // Subsequent polls: incremental — only messages after lastMsgId.
        var url = apiUrl + "/widget/messages?conversation_id=" + encodeURIComponent(convId);
        if (sessionToken) url += "&session_token=" + encodeURIComponent(sessionToken);
        if (!firstPoll && lastMsgId) url += "&after_id=" + encodeURIComponent(lastMsgId);
        var resp = await fetch(url, { headers: { "X-API-Key": apiKey, "ngrok-skip-browser-warning": "true" } });

        // 404 with widget_message_not_found: after_id stale — fall back to full reload
        if (resp.status === 404) {
          var errData = await resp.json().catch(function () { return {}; });
          if (errData.error && errData.error.code === "widget_message_not_found") {
            lastMsgId = null;
            firstPoll = true;
            renderedIds = new Set();
          }
          return;
        }
        if (!resp.ok) return;

        var data = await resp.json();
        var items = data.items || data.messages || [];
        if (firstPoll) {
          // Bootstrap: mark all existing history as seen so SSE-rendered
          // messages are not duplicated. Nothing is rendered on this pass.
          items.forEach(function (msg) { renderedIds.add(msg.id); if (msg.id) lastMsgId = msg.id; });
          firstPoll = false;
        } else {
          // Incremental: backend returns only new messages — render everything.
          // renderedIds is a safety net for any edge-case duplicates.
          items.forEach(function (msg) {
            if (renderedIds.has(msg.id)) return;
            renderedIds.add(msg.id);
            if (msg.role === "system_notice") return;
            if (msg.role === "user") { lastMsgId = msg.id; return; }
            // role=assistant during handoff means a human operator reply
            if (msg.role === "assistant") {
              if (agentTypingEl) { agentTypingEl.remove(); agentTypingEl = null; }
              addMessage("agent", msg.content, [], null, msg.created_at);
            }
            lastMsgId = msg.id;
          });
        }
        // Show or hide the agent typing indicator based on backend signal
        if (data.agent_typing) {
          if (!agentTypingEl) {
            agentTypingEl = document.createElement("div");
            agentTypingEl.className = "pa-msg-row agent";
            var typingWrap = document.createElement("div");
            typingWrap.className = "pa-msg-wrap assistant";
            var typingBubble = document.createElement("div");
            typingBubble.className = "pa-msg thinking";
            typingBubble.innerHTML = '<div class="pa-typing-dots"><span></span><span></span><span></span></div>';
            typingWrap.appendChild(typingBubble);
            agentTypingEl.appendChild(_makeAvatar(true));
            agentTypingEl.appendChild(typingWrap);
            messages.appendChild(agentTypingEl);
            scrollToBottom(true);
          }
        } else if (agentTypingEl) {
          agentTypingEl.remove();
          agentTypingEl = null;
        }
        if (data.status === "resolved" || data.conversation_status === "closed") {
          clearInterval(handoffPollInterval);
          handoffPollInterval = null;
          if (agentTypingEl) { agentTypingEl.remove(); agentTypingEl = null; }
          addMessage("system", "This conversation has been resolved. Thank you.");
        }
      } catch (e) {
        // Silent — next tick will retry
      }
    }, 3000);
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  async function sendMessage(text) {
    if (!text) {
      text = input.value.trim();
      if (!text && !pendingFile) return;
      input.value = "";
      input.style.height = "auto";
    }

    var displayText = text;
    var attachmentInfo = null;
    if (pendingFile) {
      attachmentInfo = { name: pendingFile.file.name, size: pendingFile.file.size };
      if (!text) {
        // Send a minimal context hint to the LLM but show chip-only bubble
        text = "I've uploaded a file: " + pendingFile.file.name + ". Please review it.";
        displayText = "";
      }
    }

    addMessage("user", displayText, null, null, null, attachmentInfo);

    // During handoff: skip the LLM entirely — the human agent is handling this.
    // Clear visitor typing signal, persist the message so the agent can see it,
    // then return. The polling loop will surface the agent's reply.
    if (handoffPollInterval) {
      if (conversationId && sessionToken) {
        // Clear typing indicator and stop heartbeat
        clearTimeout(visitorTypingTimer);
        visitorTypingTimer = null;
        clearInterval(visitorTypingHeartbeat);
        visitorTypingHeartbeat = null;
        fetch(apiUrl + "/widget/typing", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
          body: JSON.stringify({ session_token: sessionToken, is_typing: false }),
        }).catch(function () {});
        // Persist the visitor message to the conversation so the human agent can read it.
        // Fire-and-forget: do not process any LLM response.
        fetch(apiUrl + "/widget/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
          body: JSON.stringify({ message: text, session_token: sessionToken, conversation_id: conversationId }),
        }).catch(function () {});
      }
      input.value = "";
      input.style.height = "auto";
      return;
    }

    var thinking = addThinking();
    setLoading(true);

    try {
      // Upload pending file first
      if (pendingFile) {
        var fileToUpload = pendingFile.file;
        pendingFile = null;
        fileChip.classList.remove("show");
        fileChipName.textContent = "";

        var formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("session_token", sessionToken);
        if (conversationId) formData.append("conversation_id", conversationId);

        try {
          var uploadResp = await fetch(apiUrl + "/widget/upload", {
            method: "POST",
            headers: { "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
            body: formData,
          });
          if (uploadResp.ok) {
            var uploadData = await uploadResp.json();
            if (uploadData.conversation_id) conversationId = uploadData.conversation_id;
            addMessage("system", "\u2705 Document ready \u2014 ask me anything about it.");
          } else {
            var uploadErr = await uploadResp.json().catch(function () { return {}; });
            var uploadErrCode = (uploadErr.error && uploadErr.error.code) || "";
            var uploadErrMsgMap = {
              "file_too_large": "File exceeds the 5\u00a0MB limit.",
              "unsupported_file_type": "That file type isn\u2019t supported. Try PDF, DOCX, TXT, MD, or HTML.",
              "inline_content_too_large": "Document is too long (max \u223c20\u00a0pages).",
              "extraction_failed": "Couldn\u2019t read this file \u2014 it may be corrupted or password-protected.",
              "empty_document": "This file has no readable text (image-only files aren\u2019t supported).",
              "widget_conversation_required": "Please send a message first before uploading a file.",
            };
            var uploadErrMsg = uploadErrMsgMap[uploadErrCode] || "File upload failed. Please try again.";
            if (thinking) { thinking.remove(); thinking = null; }
            setLoading(false);
            addMessage("system", uploadErrMsg);
            return;
          }
        } catch (e) {
          if (thinking) { thinking.remove(); thinking = null; }
          setLoading(false);
          addMessage("system", "File upload failed. Please check your connection and try again.");
          return;
        }
      }

      var headers = { "Content-Type": "application/json", "X-API-Key": apiKey, "ngrok-skip-browser-warning": "true", "Idempotency-Key": generateUUID() };

      // Non-streaming path: POST to /widget/chat and render the full response
      // at once. Still shows a typing indicator while waiting so the user sees
      // activity. Used when widget_config.enable_streaming === false.
      if (!streamingEnabled) {
        var nonStreamResp = await fetch(apiUrl + "/widget/chat", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ message: text, session_token: sessionToken, ...(conversationId ? { conversation_id: conversationId } : {}) }),
        });
        if (thinking) { thinking.remove(); thinking = null; }
        if (!nonStreamResp.ok) {
          var nsErr = await nonStreamResp.json().catch(function () { return {}; });
          addMessage("assistant", "Error: " + ((nsErr.detail && nsErr.detail.message) || "Something went wrong"));
          return;
        }
        var nsData = await nonStreamResp.json();
        if (nsData.conversation_id) conversationId = nsData.conversation_id;
        var nsMsg = nsData.assistant_message || {};
        addMessage(
          "assistant",
          nsMsg.content || "",
          nsMsg.citations || [],
          nsMsg.id || null,
        );
        // Handle server-side handoff flag
        if (nsData.handoff_requested && conversationId) {
          addMessage("system", "Your request has been received. A support agent will join this conversation shortly.");
          startHandoffPolling(conversationId, lastMsgId);
        }
        return;
      }

      var resp = await fetch(apiUrl + "/widget/chat/stream", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ message: text, session_token: sessionToken, ...(conversationId ? { conversation_id: conversationId } : {}) }),
      });

      if (!resp.ok) {
        if (thinking) { thinking.remove(); thinking = null; }
        var errData = await resp.json().catch(function () { return {}; });
        addMessage("assistant", "Error: " + ((errData.detail && errData.detail.message) || "Something went wrong"));
        return;
      }

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var sseBuffer = "";
      var streamWrap = null;
      var streamContent = "";

      try {
        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          sseBuffer += decoder.decode(chunk.value, { stream: true });

          // Split on double newline (SSE event boundary)
          var parts = sseBuffer.split("\n\n");
          sseBuffer = parts.pop();

          for (var pi = 0; pi < parts.length; pi++) {
            var lines = parts[pi].split("\n");
            // Parse SSE fields: event name + data line
            var eventName = "";
            var dataLine  = "";
            for (var li = 0; li < lines.length; li++) {
              var line = lines[li];
              if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataLine = line.slice(5).trim();
              }
            }
            if (!dataLine) continue;
            var event;
            try { event = JSON.parse(dataLine); } catch (e) { continue; }

            // Support both old format (type in JSON) and new named-event format
            var evtType = eventName || event.type || "";
            // Map new event names to canonical names
            if (evtType === "delta")  evtType = "token";
            if (evtType === "end")    evtType = "done";

            // Normalise payload fields: new format uses "chunk", old uses "content"
            if (evtType === "token" && event.chunk !== undefined && event.content === undefined) {
              event.content = event.chunk;
            }

            if (evtType === "token") {
                if (!streamWrap) {
                  if (thinking) { thinking.remove(); thinking = null; }
                  streamWrap = addStreamingMessage();
                }
                streamContent += event.content;
                var bubble = streamWrap.querySelector(".pa-msg");
                if (bubble) {
                  bubble.textContent = streamContent;
                  scrollToBottom(false);
                }
              } else if (evtType === "done") {
                if (event.conversation_id) conversationId = event.conversation_id;
                if (streamWrap) {
                  finalizeStreamMessage(streamWrap, streamContent, event.citations, event.message_id || null);
                  streamWrap = null;
                } else if (thinking) {
                  thinking.remove();
                  thinking = null;
                }
                // New contract (2026-05-18): handoff_requested may arrive in the
                // end payload instead of (or in addition to) a separate SSE event.
                if (event.handoff_requested && conversationId) {
                  addMessage("system", "Your request has been received. A support agent will join this conversation shortly.");
                  startHandoffPolling(conversationId, lastMsgId);
                }
              } else if (evtType === "error") {
                if (thinking) { thinking.remove(); thinking = null; }
                if (streamWrap) {
                  finalizeStreamMessage(streamWrap, streamContent || ("Error: " + event.message), [], null);
                } else {
                  addMessage("assistant", "Error: " + event.message);
                }
              } else if (evtType === "auth_required") {
                if (thinking) { thinking.remove(); thinking = null; }
                if (streamWrap) streamWrap.remove();
                conversationId = event.conversation_id || conversationId;
                pendingMessage = text;
                showAuthModal(event.auth_level, event.auth_fields, event.pending_tool);
              } else if (evtType === "handoff_requested") {
                // Visitor asked for a human. The backend already closed the
                // stream on its side — clean up the thinking indicator, show
                // the system notice, and start polling for agent replies.
                if (thinking) { thinking.remove(); thinking = null; }
                if (streamWrap) {
                  // Drop the empty AI bubble if nothing was streamed yet
                  if (!streamContent) streamWrap.remove();
                  else finalizeStreamMessage(streamWrap, streamContent, [], null);
                  streamWrap = null;
                }
                conversationId = event.conversation_id || conversationId;
                var handoffMsg = event.message
                  || "Your request has been received. A support agent will join this conversation shortly.";
                addMessage("system", handoffMsg);
                if (conversationId) startHandoffPolling(conversationId, lastMsgId);
              } else if (evtType === "system_notice") {
                // Message persisted on backend — just drop the thinking indicator,
                // no need to surface the raw notice to the visitor here
                if (thinking) { thinking.remove(); thinking = null; }
              }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      if (thinking) { thinking.remove(); thinking = null; }
      addMessage("assistant", "Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  // applyWidgetConfig: applies position/title/css immediately on load so the
  // button is already in the right place before the user opens the panel.
  async function applyWidgetConfig() {
    try {
      var initBody = sessionToken ? JSON.stringify({ session_token: sessionToken }) : "{}";
      var resp = await fetch(apiUrl + "/widget/init", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
        body: initBody,
      });
      // 401 = expired / invalid session_token — retry fresh (no token)
      if (resp.status === 401) {
        sessionToken = null;
        sessionStorage.removeItem("pa_session_" + agentId);
        sessionStorage.removeItem("pa_session_expires_" + agentId);
        resp = await fetch(apiUrl + "/widget/init", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
          body: "{}",
        });
      }
      if (!resp.ok) return;
      var data = await resp.json();

      // Store the session token (and expiry) returned by init
      if (data.session_token) {
        sessionToken = data.session_token;
        sessionStorage.setItem("pa_session_" + agentId, sessionToken);
      }
      if (data.expires_at) {
        sessionStorage.setItem("pa_session_expires_" + agentId, data.expires_at);
      }

      // Cache for use by initWidget so it doesn't fetch twice
      applyWidgetConfig._cached = data;

      if (data.agent_name) agentNameEl.textContent = data.agent_name;
      var brandColorVal = data.widget_config && data.widget_config.color;
      if (brandColorVal) applyBranding(brandColorVal);
      var avatarUrl = data.widget_config && data.widget_config.avatar_url;
      if (avatarUrl) {
        var avatar = shadow.getElementById("pa-agent-avatar");
        avatar.src = avatarUrl;
        avatar.classList.add("show");
      }

      var wc = data.widget_config || {};

      // Streaming preference — null means not configured, default to enabled
      streamingEnabled = wc.streaming_enabled !== false;

      // Position: normalise both underscore and hyphen variants from backend
      var pos = (wc.position || "").replace("_", "-");
      if (pos === "bottom-left") {
        btn.style.right = "auto";
        btn.style.left  = "24px";
        panel.style.right = "auto";
        panel.style.left  = "24px";
      } else {
        btn.style.left = "auto";
        btn.style.right = "24px";
        panel.style.left = "auto";
        panel.style.right = "24px";
      }

      // Widget title override
      if (wc.widget_title) agentNameEl.textContent = wc.widget_title;

      // Suggested prompts from widget_config (if no data-suggestions attribute)
      if (!suggestionsAttr && wc.suggested_prompts && wc.suggested_prompts.length) {
        showSuggestions(wc.suggested_prompts);
      }

      // Custom CSS injection
      if (wc.custom_css) {
        var customStyleEl = shadow.getElementById("pa-custom-css");
        if (!customStyleEl) {
          customStyleEl = document.createElement("style");
          customStyleEl.id = "pa-custom-css";
          shadow.appendChild(customStyleEl);
        }
        customStyleEl.textContent = wc.custom_css;
      }
    } catch (err) {
      // Non-critical — widget still works without config
    }
  }

  async function initWidget() {
    if (greeted) return;
    greeted = true;

    // Show suggestions from data-suggestions attribute immediately
    if (suggestionsAttr) {
      var list = suggestionsAttr.split("|").map(function (s) { return s.trim(); }).filter(Boolean);
      showSuggestions(list);
    }

    try {
      // Reuse the already-fetched config if available, otherwise fetch now
      var data = applyWidgetConfig._cached || null;
      if (!data) {
        var iBody = sessionToken ? JSON.stringify({ session_token: sessionToken }) : "{}";
        var resp = await fetch(apiUrl + "/widget/init", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
          body: iBody,
        });
        if (resp.status === 401) {
          sessionToken = null;
          sessionStorage.removeItem("pa_session_" + agentId);
          sessionStorage.removeItem("pa_session_expires_" + agentId);
          resp = await fetch(apiUrl + "/widget/init", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
            body: "{}",
          });
        }
        if (!resp.ok) return;
        data = await resp.json();
        if (data.session_token) {
          sessionToken = data.session_token;
          sessionStorage.setItem("pa_session_" + agentId, sessionToken);
        }
        if (data.expires_at) {
          sessionStorage.setItem("pa_session_expires_" + agentId, data.expires_at);
        }
        applyWidgetConfig._cached = data;
      }

      var greetingMsg = (data.widget_config && data.widget_config.greeting) || data.greeting;
      if (greetingMsg) {
        addMessage("assistant", greetingMsg);
      }
    } catch (err) {
      // Non-critical
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────

  // State machine transitions. Conversation state (messages DOM, conversationId)
  // is preserved across open/minimize cycles; only explicit close clears it back
  // to 'closed' which hides the pulsing indicator.
  function setWidgetState(next) {
    widgetState = next;
    if (next === "open") {
      panel.classList.add("open");
      btn.classList.remove("pa-minimized");
      btn.setAttribute("aria-label", "Minimize chat");
    } else if (next === "minimized") {
      panel.classList.remove("open");
      btn.classList.add("pa-minimized");
      btn.setAttribute("aria-label", "Resume chat");
    } else {
      // closed (only used internally by reset)
      panel.classList.remove("open");
      btn.classList.remove("pa-minimized");
      btn.setAttribute("aria-label", "Open chat");
    }
  }

  btn.addEventListener("click", function () {
    if (widgetState === "open") {
      // Floating button while open minimizes the panel
      setWidgetState("minimized");
      return;
    }
    // From 'minimized' -> open. Init already ran on page load.
    setWidgetState("open");
    input.focus();
  });

  // Apply position/branding immediately on page load so the button is already
  // in the correct position before the user ever clicks it.
  applyWidgetConfig();

  // Auto-open and init on every page load so the widget is immediately ready.
  setWidgetState("open");
  initWidget();

  // Minimize keeps conversation state intact and shows the pulsing indicator
  minimizeBtn.addEventListener("click", function () {
    setWidgetState("minimized");
  });

  resetBtn.addEventListener("click", resetConversation);

  // Delegated copy handler for code blocks
  messages.addEventListener("click", function (e) {
    var btn = e.target.closest(".pa-code-copy");
    if (!btn) return;
    var codeEl = btn.closest(".pa-code-block") && btn.closest(".pa-code-block").querySelector("code");
    if (!codeEl) return;
    navigator.clipboard.writeText(codeEl.textContent).then(function () {
      btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = "Copy"; }, 1500);
    }).catch(function () {});
  });

  sendBtn.addEventListener("click", function () { sendMessage(); });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea as user types
  var visitorTypingTimer = null;
  input.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
    updateSendBtn();

    // While in handoff mode, signal visitor typing state to the backend (debounced)
    if (handoffPollInterval && conversationId) {
      var isEmpty = this.value.trim() === "";
      if (!isEmpty) {
        // Only send is_typing=true once per burst; debounce the idle clear
        if (!visitorTypingTimer) {
          // First keydown of a new burst — send is_typing=true immediately
          fetch(apiUrl + "/widget/typing", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
            body: JSON.stringify({ session_token: sessionToken || "", is_typing: true }),
          }).catch(function () {});
          // Heartbeat: re-send is_typing=true every 10 s to keep the 15 s backend TTL alive
          if (!visitorTypingHeartbeat) {
            visitorTypingHeartbeat = setInterval(function () {
              if (!handoffPollInterval) { clearInterval(visitorTypingHeartbeat); visitorTypingHeartbeat = null; return; }
              fetch(apiUrl + "/widget/typing", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
                body: JSON.stringify({ session_token: sessionToken || "", is_typing: true }),
              }).catch(function () {});
            }, 10000);
          }
        }
        clearTimeout(visitorTypingTimer);
        visitorTypingTimer = setTimeout(function () {
          visitorTypingTimer = null;
          // Idle for 3 s — clear typing indicator and stop heartbeat
          clearInterval(visitorTypingHeartbeat);
          visitorTypingHeartbeat = null;
          fetch(apiUrl + "/widget/typing", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
            body: JSON.stringify({ session_token: sessionToken || "", is_typing: false }),
          }).catch(function () {});
        }, 3000);
      }
    }
  });

  // Clear visitor typing indicator immediately on blur — also stop heartbeat
  input.addEventListener("blur", function () {
    if (handoffPollInterval && conversationId) {
      clearTimeout(visitorTypingTimer);
      visitorTypingTimer = null;
      clearInterval(visitorTypingHeartbeat);
      visitorTypingHeartbeat = null;
      fetch(apiUrl + "/widget/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Idempotency-Key": generateUUID(), "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ session_token: sessionToken || "", is_typing: false }),
      }).catch(function () {});
    }
  });

  // Scroll-to-bottom button visibility
  messages.addEventListener("scroll", function () {
    var atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 50;
    scrollBtn.classList.toggle("show", !atBottom);
  });

  scrollBtn.addEventListener("click", function () {
    messages.scrollTop = messages.scrollHeight;
  });

  authSubmit.addEventListener("click", handleAuthSubmit);

  authCancel.addEventListener("click", function () {
    pendingMessage = null;
    closeAuthModal();
  });

  otpInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); handleAuthSubmit(); }
  });

  uploadBtn.addEventListener("click", function () { fileInput.click(); });

  var ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/html",
  ];
  var MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

  fileInput.addEventListener("change", function () {
    var file = fileInput.files[0];
    if (!file) return;
    fileInput.value = "";

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      addMessage("system", "That file type isn\u2019t supported. Try PDF, DOCX, TXT, MD, or HTML.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      addMessage("system", "File exceeds the 5\u00a0MB limit.");
      return;
    }

    pendingFile = { file: file, fileId: null };
    fileChipName.textContent = file.name;
    fileChip.classList.add("show");
    updateSendBtn();
  });

  fileRemove.addEventListener("click", function () {
    pendingFile = null;
    fileChip.classList.remove("show");
    fileChipName.textContent = "";
    updateSendBtn();
  });
})();
