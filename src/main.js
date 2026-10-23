import "./style.css";
const app = document.querySelector("#app");
let user = null,
  tasks = [],
  categories = [
    "Graphic design",
    "Web development",
    "Social media",
    "Writing",
    "Small-business support",
  ],
  projects = [],
  ownedTasks = [],
  evidence = [],
  confirmations = [],
  passport = null;
let view = location.hash.slice(1) || "discover",
  query = "",
  category = "All opportunities",
  sort = "match",
  publicPassport = null;
const publicToken = location.pathname.match(
  /^\/passport\/([a-zA-Z0-9-]+)\/?$/,
)?.[1];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => "R " + Number(n).toLocaleString("en-ZA");
const date = (value) =>
  value
    ? new Date(
        value.length === 10 ? value + "T12:00:00" : value,
      ).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const fullDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-ZA", {
        timeZone: "Africa/Johannesburg",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " SAST"
    : "—";
const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
const skillList = (s) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const tags = (list) =>
  `<div class="tags">${list.map((s) => `<span>${esc(s)}</span>`).join("")}</div>`;
const link = (url, label = "Open work link ↗") =>
  url
    ? `<a class="work-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
    : "";
const labels = {
  applied: "Applied",
  assigned: "Assigned",
  not_selected: "Not selected",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  completed: "Completed",
  open: "Open",
  requested: "Awaiting confirmation",
  confirmed: "Confirmed by a contact",
  declined: "Declined",
  withdrawn: "Withdrawn",
  superseded: "Previous version",
};
const status = (s) =>
  `<span class="status-badge ${s}">${esc(labels[s] || s)}</span>`;
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch("/api" + path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new Error(
      "Could not reach the server. Check your connection and try again.",
    );
  }
  const data = await response
    .json()
    .catch(() => ({ error: "The server returned an unexpected response." }));
  if (!response.ok) {
    if (response.status === 401 && user) {
      user = null;
    }
    throw new Error(data.error || "The request failed.");
  }
  return data;
}
function toast(message) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 4500);
}
function header(title, subtitle, eyebrow = "YOUR NEXT CHAPTER") {
  return `<section class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}<span>.</span></h1><p>${subtitle}</p></div></section>`;
}
function navItems() {
  return [
    ["discover", "▦", "Opportunities"],
    [
      "projects",
      "▣",
      user?.role === "business" ? "Business tasks" : "My projects",
    ],
    ["passport", "◈", "Skills passport"],
    ["confirmations", "✓", "Confirmations"],
    ["profile", "◯", "My profile"],
  ].filter(([v]) => v !== "passport" || user?.role !== "business");
}
function shell(content) {
  if (publicToken)
    return `<div class="public-shell"><div class="public-header"><a class="brand" href="/"><span class="brand-icon">s<span>↗</span></span><span>skillbridge<span class="sa">SA</span></span></a><a class="button secondary" href="/">Explore opportunities ↗</a></div><main>${content}</main><footer>SkillBridge SA · Evidence of work. A bridge to what’s next.</footer><div id="modal-root"></div></div>`;
  return `<aside class="sidebar"><a class="brand" href="#discover"><span class="brand-icon">s<span>↗</span></span><span>skillbridge<span class="sa">SA</span></span></a><div class="workspace-label">YOUR WORKSPACE</div><nav>${navItems()
    .map(
      ([v, icon, title]) =>
        `<button data-view="${v}" class="nav-item ${view === v ? "active" : ""}"><span>${icon}</span>${title}</button>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-bottom"><div class="grow-card"><span class="grow-icon">✧</span><h3>Your experience counts.</h3><p>Document what you can do. Build proof with every project.</p><button data-view="${user?.role === "business" ? "projects" : "passport"}">${user?.role === "business" ? "Find your next collaborator" : "Build your skills passport"} <span>↗</span></button></div><button class="help" id="help">ⓘ <span>How it works</span> ↗</button>${user ? `<button class="user" data-view="profile"><span class="avatar">${esc(initials(user.name))}</span><span><strong>${esc(user.name)}</strong><small>${user.role === "talent" ? "Talent" : "Business"} account</small></span><span>⌄</span></button>` : '<button class="button dark sign-in-sidebar" data-auth="login">Sign in ↗</button>'}</div></aside><div class="main-shell"><header><div class="breadcrumb">Your workspace <span>/</span><strong>${esc(navItems().find((x) => x[0] === view)?.[2] || "Opportunities")}</strong></div><div class="header-actions"><span class="demo"><i></i> Hackathon MVP</span>${user ? `<button class="text-button" id="logout">Sign out</button><button class="avatar small" data-view="profile" aria-label="My profile">${esc(initials(user.name))}</button>` : '<button class="button secondary" data-auth="login">Sign in</button><button class="button primary" data-auth="register">Get started ↗</button>'}</div></header><main>${content}</main><footer><span>Built for South African talent and small businesses.</span><span>Evidence of work. A bridge to what’s next. <b>✳</b></span></footer></div><div id="modal-root"></div>`;
}
function render() {
  let content;
  if (publicToken)
    content = publicPassport
      ? passportDisplay(publicPassport, true)
      : header(
          "Passport unavailable",
          "This passport is private, unavailable, or its share link has changed.",
        );
  else
    content =
      view === "discover"
        ? discover()
        : !user
          ? gate()
          : view === "projects"
            ? projectPage()
            : view === "passport" && user.role === "talent"
              ? passportPage()
              : view === "confirmations"
                ? confirmationPage()
                : profilePage();
  app.innerHTML = shell(content);
  bind();
}
function gate() {
  return `${header("Your next chapter starts here", "Create an account to build your passport, apply for opportunities, or post a business task.")}<section class="empty"><span>↗</span><h2>Bring your skills. Build your proof.</h2><p>Talent and businesses use separate accounts. Your work and confirmations are stored securely on the server.</p><button class="button primary" data-auth="register">Create an account ↗</button><button class="button secondary" data-auth="login">I already have an account</button></section>`;
}
function discover() {
  return `<section class="page-heading"><div><div class="eyebrow">REAL SKILLS. REAL POSSIBILITIES.</div><h1>Your next opportunity starts here<span>.</span></h1><p>Put your skills to work. Build experience you can show.</p></div><button class="button secondary" id="post-task">Post a task ＋</button></section><section class="hero"><div class="hero-copy"><div class="hero-badge">✦ MORE THAN A CV. PROOF OF YOUR POTENTIAL.</div><h2>A little skill.<br>A world of <em>possibility.</em></h2><p>Start with what you know. Complete a real project.<br class="desktop"/> Carry the evidence into your next opportunity.</p><button class="button dark" id="explore">Find your opportunity <span>↗</span></button><div class="hero-note">✦ Your experience counts. Let’s make it visible.</div></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="art-star star-one">✳</span><span class="art-star star-two">✧</span><div class="floating-label label-one">✦ Your next chapter</div><div class="art-window"><div class="window-bar"><span>● ● ●</span><span>YOUR SKILLS PASSPORT ↗</span></div><div class="window-body"><div class="art-sun">✳</div><span class="art-cursor">➤</span><div class="window-line"></div><div class="window-line short"></div><span class="art-pill">Made of potential.</span></div></div><div class="floating-label label-two"><span>✓</span><div>Skills → experience<strong>Proof you can carry.</strong></div><span>↗</span></div></div></section><section class="quick-stats"><div><span class="stat-icon peach">↗</span><div><strong>${tasks.length} open opportunities</strong><small>Find a practical first step</small></div></div><div><span class="stat-icon sage">▤</span><div><strong>Experience that counts</strong><small>Past work and completed projects</small></div></div><div><span class="stat-icon lilac">◈</span><div><strong>Your skills passport</strong><small>Share the evidence you choose</small></div></div></section><section id="opportunities"><div class="section-heading"><div><h2>Find your next opportunity <span>↗</span></h2><p>Digital services and everyday small-business support.</p></div></div><div class="search-row"><label class="search-box"><span>⌕</span><input id="search" value="${esc(query)}" aria-label="Search opportunities" placeholder="Try “Canva”, “customer service” or “stock”…"/><kbd>⌘ K</kbd></label><select id="sort" aria-label="Sort opportunities"><option value="match" ${sort === "match" ? "selected" : ""}>Best skill matches</option><option value="budget" ${sort === "budget" ? "selected" : ""}>Highest budget first</option><option value="deadline" ${sort === "deadline" ? "selected" : ""}>Earliest deadline first</option></select></div><div class="categories">${["All opportunities", ...categories].map((c, i) => `<button data-category="${esc(c)}" class="${category === c ? "active" : ""}">${["✦", "◈", "⌘", "◎", "✎", "▤"][i]} ${esc(c)}</button>`).join("")}</div><div id="task-results">${taskResults()}</div></section><section class="bottom-banner"><span>✳</span><div><h3>Experience shouldn’t disappear when the work is done.</h3><p>Build a passport with your past work, confirmations and completed projects.</p></div><button class="button secondary" data-view="${user?.role === "business" ? "projects" : "passport"}">${user?.role === "business" ? "Manage tasks" : "Build my passport"} ↗</button></section>`;
}
function taskResults() {
  let list = tasks.filter(
    (t) =>
      (category === "All opportunities" || category === t.category) &&
      [t.title, t.description, t.business_name, ...t.skills]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (sort === "budget") list.sort((a, b) => b.budget - a.budget);
  if (sort === "deadline")
    list.sort((a, b) => a.deadline.localeCompare(b.deadline));
  return `<div class="results-caption"><span>${list.length} ${list.length === 1 ? "opportunity" : "opportunities"} · Matches use exact recorded skills, not AI assessment</span></div><div class="task-grid">${list.length ? list.map(taskCard).join("") : '<div class="empty"><span>⌕</span><h3>No opportunities found</h3><p>Try another skill or category. Businesses can post a new task.</p></div>'}</div>`;
}
function taskCard(t) {
  return `<article class="task-card"><div class="card-top"><span class="company-logo ${t.isDemo ? "coffee" : "green"}">${esc(initials(t.business_name))}</span><div class="company-info"><strong>${esc(t.business_name)}</strong><span>${esc(t.location || "South Africa")} · Remote friendly</span></div></div><div class="card-category">${esc(t.category)}${t.isDemo ? "<span>Fictional demo task</span>" : ""}</div><button class="card-title" data-task="${esc(t.id)}">${esc(t.title)}</button><p>${esc(t.description)}</p>${tags(t.skills)}<div class="match-reason ${t.matchedSkills.length ? "has-match" : ""}">✦ ${esc(t.matchReason)}</div><div class="card-meta"><div><strong>${money(t.budget)}</strong><span>Agreed project budget</span></div><div class="deadline">◷ <span>Due ${date(t.deadline)}</span></div></div><div class="card-footer"><span>${t.applicants} ${t.applicants === 1 ? "applicant" : "applicants"}</span><button data-task="${esc(t.id)}">View task <span>↗</span></button></div></article>`;
}
function projectPage() {
  return `${header(user.role === "business" ? "Small projects. Shared progress" : "Your work, taking shape", user.role === "business" ? "Review applications, choose talent and approve completed work." : "Follow your applications, submit your work and build your passport.", "FROM OPPORTUNITY TO EXPERIENCE")}${user.role === "business" ? `<div class="section-heading"><h2>Your tasks</h2><button class="button primary" id="post-task">Post a task ＋</button></div><div class="owned-tasks">${ownedTasks.length ? ownedTasks.map((t) => `<article class="owned-task"><div><h3>${esc(t.title)}</h3><p>${money(t.budget)} · Due ${date(t.deadline)} · ${t.applicants} applicants ${t.isDemo ? "· Fictional demo task" : ""}</p></div>${status(t.status)}</article>`).join("") : '<div class="notice">No tasks yet. Post a clear brief to get started.</div>'}</div><div class="section-heading"><h2>Applications & active projects</h2></div>` : ""}<div class="project-list">${projects.length ? projects.map((a) => `<article class="project-row"><span class="company-logo green">${esc(initials(user.role === "business" ? a.talent_name : a.business_name))}</span><div class="project-info"><small>${esc(user.role === "business" ? a.talent_name : a.business_name)}</small><h3>${esc(a.title)}</h3><span>${money(a.budget)} · Due ${date(a.deadline)}</span></div><div class="project-actions">${status(a.status)}<button class="button secondary" data-project="${esc(a.id)}">${user.role === "business" && a.status === "applied" ? "Review application" : "View project"} ↗</button></div></article>`).join("") : `<div class="empty"><span>↗</span><h2>${user.role === "business" ? "Good work begins with an opportunity" : "Your next chapter is waiting"}</h2><p>${user.role === "business" ? "Applications from talent will appear here after you post a task." : "Apply for an opportunity. Your application and project progress will appear here."}</p><button class="button primary" data-view="discover">Explore opportunities ↗</button></div>`}</div><div class="notice">Budgets record the agreed value of work. SkillBridge does not collect, hold or guarantee payments. Agree payment terms directly before work starts.</div>`;
}
function evidenceCard(e, publicView = false) {
  const confirmed =
    e.confirmations?.length &&
    e.confirmations.some((c) => !c.status || c.status === "confirmed");
  return `<article class="evidence-card"><div class="evidence-heading"><div><small>${esc(e.organisation)} · ${esc(e.period)}</small><h3>${esc(e.title)}</h3></div><span class="status-badge ${confirmed ? "confirmed" : "self-declared"}">${confirmed ? "Confirmed by a contact" : "Self-declared"}</span></div><p class="preserve">${esc(e.description)}</p>${tags(e.skills)}${link(e.work_url)}${e.confirmations?.length ? `<div class="confirmation-history">${e.confirmations.map((c) => `<div><strong>${esc(c.confirmer_name)}</strong> ${!c.status || c.status === "confirmed" ? "confirmed this experience" : esc(labels[c.status])}${c.relationship ? ` · ${esc(c.relationship)}` : ""}<small>${fullDate(c.responded_at || c.created_at)}${c.revision ? ` · Version ${c.revision}` : ""}</small>${c.statement ? `<p class="preserve">“${esc(c.statement)}”</p>` : ""}</div>`).join("")}</div>` : ""}${publicView ? "" : `<div class="evidence-actions"><span class="visibility-label">${e.public_consent ? "◉ Selected for public passport" : "◌ Private evidence"}</span><button class="text-button" data-evidence-visibility="${esc(e.id)}">${e.public_consent ? "Make private" : "Allow public sharing"}</button><button class="text-button" data-edit-evidence="${esc(e.id)}">Edit</button><button class="text-button" data-request="${esc(e.id)}">Request confirmation ↗</button><button class="text-button danger" data-delete-evidence="${esc(e.id)}">Delete</button></div>`}</article>`;
}
function passportPage() {
  return `${header("Your experience. Your proof", "Bring together the work you’ve done and the people who can confirm it.", "YOUR SKILLS PASSPORT")}<div class="passport-layout"><div><div class="section-heading"><h2>Previous work experience</h2><button class="button primary" id="add-evidence">Add experience ＋</button></div><div class="evidence-list">${evidence.length ? evidence.map((e) => evidenceCard(e)).join("") : `<div class="empty"><span>◈</span><h2>You have a story worth showing</h2><p>Add a past project or experience in customer service, stock capture, administration or digital services.</p><button class="button secondary" id="first-evidence">Add your first experience ↗</button></div>`}</div><div class="section-heading spaced"><h2>Completed SkillBridge projects</h2></div>${passport?.completed.length ? passport.completed.map((a) => completedCard(a, false)).join("") : '<div class="notice">Business-approved projects appear here once you complete the task journey. Only projects you allow will appear on your public passport.</div>'}</div><aside class="sharing-panel"><span class="grow-icon">◈</span><h3>Proof you can carry.</h3><p>Share a read-only passport with an employer. Choose each experience and completed project you want to include.</p><div class="notice compact-notice">Your name, headline, location, bio and profile skills are visible when sharing is on. Email and private entries stay hidden.</div><label class="checkbox-label"><input type="checkbox" id="sharing-toggle" ${passport?.sharePublic ? "checked" : ""}/> Enable public passport</label>${passport?.sharePublic ? `<div id="qr-container" class="qr-container"><span>Loading QR code…</span></div><a class="button secondary full" href="${esc(passport.url)}" target="_blank" rel="noopener noreferrer">View public passport ↗</a><button class="button primary full" id="copy-passport">Copy share link</button><button class="text-button" id="rotate-passport">Replace share link</button>` : '<div class="private-passport">◌ Your passport is private.<br/>Enable sharing to create a public link and QR code.</div>'}<p class="small-print">Contact confirmations are statements by account holders, not independent assessments. This passport is not a qualification or NQF certification.</p></aside></div>`;
}
function completedCard(a, publicView) {
  return `<article class="evidence-card completed-card"><div class="evidence-heading"><div><small>${esc(a.business_name)} · ${date(a.updated_at)}${a.isDemo ? " · Fictional demo task" : ""}</small><h3>${esc(a.title)}</h3></div><span class="status-badge completed">Completed through SkillBridge</span></div><h4>The brief</h4><p class="preserve">${esc(a.description)}</p>${tags(a.skills)}<h4>Submitted work</h4><p class="preserve">${esc(a.submission)}</p>${link(a.work_url)}<div class="confirmation-history"><strong>Business feedback</strong><p class="preserve">“${esc(a.feedback)}”</p><small>Approved by ${esc(a.business_name)} · ${fullDate(a.updated_at)}</small></div>${publicView ? "" : `<div class="evidence-actions"><span>${a.public_consent ? "◉ Selected for public passport" : "◌ Private project"}</span><button class="text-button" data-project-visibility="${esc(a.id)}">${a.public_consent ? "Make private" : "Allow public sharing"}</button></div>`}</article>`;
}
function passportDisplay(p, publicView) {
  return `${header("A little proof. A lot of potential", "A work evidence passport shared by its owner.", "SKILLBRIDGE SA · PUBLIC PASSPORT")}<section class="portfolio-profile"><span class="avatar large">${esc(initials(p.profile.name))}</span><div><h2>${esc(p.profile.name)}</h2><p>${esc(p.profile.headline || "Building experience, one project at a time.")}</p><span>${esc(p.profile.location)}</span></div></section>${p.profile.bio ? `<p class="profile-bio preserve">${esc(p.profile.bio)}</p>` : ""}${tags(p.profile.skills)}<div class="notice">${esc(p.disclaimer)}</div><div class="section-heading"><h2>Work experience</h2></div><div class="evidence-list">${p.evidence.length ? p.evidence.map((e) => evidenceCard(e, publicView)).join("") : '<div class="notice">No previous experience has been shared publicly.</div>'}</div><div class="section-heading spaced"><h2>Completed projects</h2></div>${p.completed.length ? p.completed.map((a) => completedCard(a, true)).join("") : '<div class="notice">No completed projects have been shared publicly.</div>'}<div class="public-footer-note">Confirmations record what the named contact stated. SkillBridge has not independently verified their identity or assessed competence. <button class="text-button" id="report-passport">Report a concern</button></div>`;
}
function confirmationPage() {
  return `${header("A little confirmation goes a long way", "Confirm only work you directly know about. Your name, statement and response time are recorded.", "EXPERIENCE, ACKNOWLEDGED")}<div class="notice">These are in-app requests. No email or SMS is sent. Talent shares your sign-in email to request your confirmation. Your email is not shown on the public passport.</div><button class="button secondary refresh-requests" id="refresh-all-confirmations">Refresh requests ↻</button><div class="evidence-list">${confirmations.length ? confirmations.map((c) => `<article class="evidence-card"><div class="evidence-heading"><div><small>Requested by ${esc(c.talent_name)} · ${fullDate(c.created_at)}</small><h3>${esc(c.title)}</h3></div>${status(c.status)}</div><p><strong>${esc(c.organisation)}</strong> · ${esc(c.period)}</p><p class="preserve">${esc(c.description)}</p>${tags(c.skills)}${link(c.work_url)}${c.statement ? `<div class="confirmation-history"><strong>Your statement · ${esc(c.relationship)}</strong><p class="preserve">${esc(c.statement)}</p><small>${fullDate(c.responded_at)}</small></div>` : ""}${c.status === "requested" ? `<button class="button primary" data-respond="${esc(c.id)}">Review this experience ↗</button>` : c.status === "confirmed" ? `<button class="text-button danger" data-withdraw="${esc(c.id)}">Withdraw my confirmation</button>` : ""}</article>`).join("") : '<div class="empty"><span>✓</span><h2>No confirmation requests yet</h2><p>When someone requests your confirmation of their past work, it appears here. Refresh to check for new requests.</p><button class="button secondary" id="refresh-confirmations">Refresh requests ↻</button></div>'}</div>`;
}
function profilePage() {
  return `${header(user.role === "business" ? "Introduce your business" : "Make your potential visible", user.role === "business" ? "A clear business profile helps talent understand who they will work with." : "Record your skills so we can explain which opportunities match.", "NICE TO MEET YOU")}<form id="profile-form" class="form-panel"><div class="profile-intro"><span class="avatar large">${esc(initials(user.name))}</span><div><h2>${user.role === "business" ? "Business" : "Talent"} profile</h2><p>${user.role === "business" ? "Post tasks and review submissions." : "Document your work and build a skills passport."}</p></div></div><label>${user.role === "business" ? "Business name" : "Full name"}<input name="name" required minlength="2" maxlength="80" value="${esc(user.name)}"/></label><label>Headline<input name="headline" maxlength="100" value="${esc(user.headline)}" placeholder="${user.role === "business" ? "A little about your business" : "e.g. Creative talent & customer service experience"}"/></label><label>Location<input name="location" maxlength="80" value="${esc(user.location)}" placeholder="e.g. Johannesburg"/></label><label>About ${user.role === "business" ? "your business" : "you"}<textarea name="bio" rows="4" maxlength="1500">${esc(user.bio)}</textarea></label>${user.role === "talent" ? `<label>Skills <small>Separate with commas. Use the same skill names you see on opportunities.</small><input name="skills" required value="${esc(user.skills.join(", "))}" placeholder="Canva, Customer service, Administration"/></label><div class="skill-suggestions">Suggested: Canva · Customer service · Stock capture · Administration · Excel · Social media · Graphic design · HTML & CSS</div>` : ""}<div class="form-error" role="alert"></div><button class="button primary" type="submit">Save profile ↗</button></form>`;
}
async function loadView() {
  if (publicToken) {
    publicPassport = await api("/public/passports/" + publicToken);
    return;
  }
  if (view === "discover") {
    const d = await api("/tasks");
    tasks = d.tasks;
    categories = d.categories;
  } else if (user && view === "projects") {
    const d = await api("/projects");
    projects = d.projects;
    ownedTasks = d.tasks;
  } else if (user && view === "passport" && user.role === "talent") {
    const [e, p] = await Promise.all([api("/evidence"), api("/passport")]);
    evidence = e.evidence;
    passport = p;
  } else if (user && view === "confirmations") {
    confirmations = (await api("/confirmations")).confirmations;
  }
}
let navigation = 0;
async function navigate(next) {
  const token = ++navigation;
  view = navItems().some((x) => x[0] === next) ? next : "discover";
  closeModal();
  if (location.hash.slice(1) !== view)
    history.replaceState(null, "", "#" + view);
  app.innerHTML = shell(
    '<div class="loading" role="status">Getting your workspace ready…</div>',
  );
  try {
    await loadView();
    if (token !== navigation) return;
    render();
    if (view === "passport" && passport?.sharePublic) loadQR();
    window.scrollTo(0, 0);
  } catch (e) {
    if (token !== navigation) return;
    app.innerHTML = shell(
      `<section class="empty"><h2>We couldn’t load this page</h2><p>${esc(e.message)}</p><button class="button primary" id="retry">Try again</button></section>`,
    );
    bind();
    document.querySelector("#retry").onclick = () => navigate(view);
  }
}
function bind() {
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.view)));
  document
    .querySelectorAll("[data-auth]")
    .forEach((b) => (b.onclick = () => authModal(b.dataset.auth)));
  document.querySelector("#logout")?.addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      user = null;
      await navigate("discover");
      toast("You’re signed out.");
    } catch (e) {
      toast(e.message);
    }
  });
  document
    .querySelector("#help")
    ?.addEventListener("click", () =>
      modal(
        "Your skills. A path forward.",
        `<ol class="help-list"><li>Create a talent profile and record your skills.</li><li>Add past work and request confirmation from another account.</li><li>Apply for a task. The business selects you, reviews your submission and approves the work.</li><li>Choose which evidence and completed projects to share in your QR-linked passport.</li></ol><div class="notice">Contact confirmations are not independent skills assessments. No qualification or payment guarantee is issued.</div>`,
      ),
    );
  document.querySelector("#search")?.addEventListener("input", (e) => {
    query = e.target.value;
    updateResults();
  });
  document.querySelector("#sort")?.addEventListener("change", (e) => {
    sort = e.target.value;
    updateResults();
  });
  document.querySelectorAll("[data-category]").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.category;
        document
          .querySelectorAll("[data-category]")
          .forEach((x) => x.classList.toggle("active", x === b));
        updateResults();
      }),
  );
  bindCards();
  document
    .querySelector("#explore")
    ?.addEventListener("click", () =>
      document
        .querySelector("#opportunities")
        .scrollIntoView({ behavior: "smooth" }),
    );
  document.querySelector("#post-task")?.addEventListener("click", postTask);
  document
    .querySelectorAll("[data-project]")
    .forEach((b) => (b.onclick = () => projectDetail(b.dataset.project)));
  document
    .querySelectorAll("#add-evidence,#first-evidence")
    .forEach((b) => (b.onclick = () => evidenceForm()));
  document
    .querySelectorAll("[data-edit-evidence]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          evidenceForm(evidence.find((e) => e.id === b.dataset.editEvidence))),
    );
  document
    .querySelectorAll("[data-request]")
    .forEach((b) => (b.onclick = () => requestConfirmation(b.dataset.request)));
  document
    .querySelectorAll("[data-delete-evidence]")
    .forEach(
      (b) => (b.onclick = () => deleteEvidence(b.dataset.deleteEvidence)),
    );
  document
    .querySelectorAll("[data-evidence-visibility]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          visibility(
            "evidence",
            b.dataset.evidenceVisibility,
            !evidence.find((e) => e.id === b.dataset.evidenceVisibility)
              .public_consent,
          )),
    );
  document
    .querySelectorAll("[data-project-visibility]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          visibility(
            "applications",
            b.dataset.projectVisibility,
            !passport.completed.find(
              (a) => a.id === b.dataset.projectVisibility,
            ).public_consent,
          )),
    );
  document
    .querySelector("#sharing-toggle")
    ?.addEventListener("change", async (e) => {
      try {
        await api("/passport/sharing", {
          method: "PUT",
          body: { sharePublic: e.target.checked },
        });
        await navigate("passport");
        toast(
          passport.sharePublic
            ? "Public sharing enabled. Only selected entries are included."
            : "Passport sharing disabled. The public link no longer works.",
        );
      } catch (err) {
        toast(err.message);
        e.target.checked = !e.target.checked;
      }
    });
  document
    .querySelector("#copy-passport")
    ?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(passport.url);
        toast("Passport link copied.");
      } catch {
        modal(
          "Your passport link",
          `<label>Copy this link<input readonly id="share-url" value="${esc(passport.url)}"/></label>`,
        );
        document.querySelector("#share-url").select();
      }
    });
  document.querySelector("#rotate-passport")?.addEventListener("click", () =>
    confirmAction(
      "Replace your share link?",
      "The old passport link and QR code will stop working. Anyone you shared it with will need the new link.",
      async () => {
        await api("/passport/rotate", { method: "POST" });
        await navigate("passport");
        toast("New link created. The old link is revoked.");
      },
    ),
  );
  document
    .querySelectorAll("[data-respond]")
    .forEach((b) => (b.onclick = () => respondConfirmation(b.dataset.respond)));
  document.querySelectorAll("[data-withdraw]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmAction(
          "Withdraw your confirmation?",
          "Your confirmation will no longer appear as current on this passport. The owner will see it marked as withdrawn.",
          async () => {
            await api("/confirmations/" + b.dataset.withdraw + "/withdraw", {
              method: "POST",
            });
            await navigate("confirmations");
            toast("Confirmation withdrawn.");
          },
        )),
  );
  document
    .querySelector("#refresh-all-confirmations")
    ?.addEventListener("click", () => navigate("confirmations"));
  document
    .querySelector("#refresh-confirmations")
    ?.addEventListener("click", () => navigate("confirmations"));
  document
    .querySelector("#report-passport")
    ?.addEventListener("click", () => report("passport", publicToken));
  const form = document.querySelector("#profile-form");
  if (form)
    handleForm(form, async (data) => {
      const result = await api("/profile", {
        method: "PUT",
        body: { ...data, skills: skillList(data.skills || "") },
      });
      user = result.user;
      await navigate("profile");
      toast("Profile saved. Your opportunity matches will use these skills.");
    });
}
function bindCards() {
  document
    .querySelectorAll("[data-task]")
    .forEach((b) => (b.onclick = () => taskDetail(b.dataset.task)));
}
function updateResults() {
  document.querySelector("#task-results").innerHTML = taskResults();
  bindCards();
}
let returnFocus = null;
function modal(title, body) {
  if (!document.querySelector(".modal")) returnFocus = document.activeElement;
  document.querySelector("#modal-root").innerHTML =
    `<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="close-modal" aria-label="Close dialog">×</button><div class="eyebrow">SKILLBRIDGE SA</div><h2 id="modal-title">${esc(title)}</h2>${body}</section></div>`;
  document.body.style.overflow = "hidden";
  document.querySelector(".close-modal").onclick = closeModal;
  document.querySelector(".modal-overlay").onclick = (e) => {
    if (e.target === e.currentTarget) closeModal();
  };
  document.querySelector(".close-modal").focus();
}
function closeModal() {
  const root = document.querySelector("#modal-root");
  if (root) root.innerHTML = "";
  document.body.style.overflow = "";
  if (returnFocus?.isConnected) returnFocus.focus();
  returnFocus = null;
}
function handleForm(form, callback) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.busy) return;
    form.dataset.busy = "true";
    const button = e.submitter || form.querySelector('button[type="submit"]'),
      original = button.textContent;
    button.disabled = true;
    button.textContent = "Please wait…";
    let error = form.querySelector(".form-error");
    if (!error) {
      error = document.createElement("div");
      error.className = "form-error";
      error.setAttribute("role", "alert");
      button.before(error);
    }
    error.textContent = "";
    try {
      await callback(Object.fromEntries(new FormData(form)), e);
    } catch (err) {
      error.textContent = err.message;
      error.scrollIntoView({ block: "nearest" });
    } finally {
      delete form.dataset.busy;
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  });
}
function authModal(mode = "login") {
  const register = mode === "register";
  modal(
    register ? "Your next chapter starts here." : "Welcome back.",
    `<p>${register ? "Join as talent or a business. You can sign out and use a separate account to test the other side." : "Sign in to continue your work and build your next opportunity."}</p><form id="auth-form">${register ? '<label>Account type<select name="role"><option value="talent">Talent — build experience & find work</option><option value="business">Business — post tasks & review work</option></select></label><label>Your name / business name<input name="name" required minlength="2" maxlength="80" autocomplete="name"/></label>' : ""}<label>Email<input name="email" type="email" required autocomplete="email" maxlength="254"/></label><label>Password<input name="password" type="password" required minlength="${register ? "10" : "1"}" maxlength="128" autocomplete="${register ? "new-password" : "current-password"}"/>${register ? "<small>At least 10 characters. Use a password unique to this app.</small>" : ""}</label><div class="form-error" role="alert"></div><button class="button primary full" type="submit">${register ? "Create account" : "Sign in"} ↗</button></form><button class="text-button auth-switch" id="switch-auth">${register ? "Already have an account? Sign in" : "New here? Create an account"}</button><details class="demo-accounts"><summary>Judge demo accounts</summary><p>Fictional shared accounts. Create your own accounts for a fresh test. Demo data can change when other testers use it.</p><button class="button secondary" data-demo="talent">Talent demo</button><button class="button secondary" data-demo="business">Business demo</button><button class="button secondary" data-demo="reviewer">Contact demo</button><p>No demo sign-in? Ask the deployment owner to enable SEED_DEMO.</p></details>`,
  );
  handleForm(document.querySelector("#auth-form"), async (data) => {
    const result = await api("/auth/" + (register ? "register" : "login"), {
      method: "POST",
      body: data,
    });
    user = result.user;
    closeModal();
    await navigate(
      register ? "profile" : user.role === "business" ? "projects" : "discover",
    );
    toast(
      register
        ? "Account created. Make it yours."
        : "Welcome back, " + user.name + ".",
    );
  });
  document.querySelector("#switch-auth").onclick = () =>
    authModal(register ? "login" : "register");
  document.querySelectorAll("[data-demo]").forEach(
    (b) =>
      (b.onclick = () => {
        if (register) {
          authModal("login");
        }
        const form = document.querySelector("#auth-form"),
          type = b.dataset.demo;
        form.elements.email.value = type + "@skillbridge.demo";
        form.elements.password.value = {
          talent: "TalentDemo!2026",
          business: "BusinessDemo!2026",
          reviewer: "ReviewerDemo!2026",
        }[type];
        form.requestSubmit();
      }),
  );
}
async function taskDetail(id) {
  try {
    const { task: t } = await api("/tasks/" + id);
    const already = projects.find((p) => p.task_id === id);
    modal(
      t.title,
      `<div class="detail-business"><span class="company-logo green">${esc(initials(t.business_name))}</span><div><strong>${esc(t.business_name)}</strong><p>${esc(t.location || "South Africa")}${t.isDemo ? " · Fictional demo task" : ""}</p></div></div><div class="detail-stats"><div><small>Project budget</small><strong>${money(t.budget)}</strong></div><div><small>Deadline</small><strong>${date(t.deadline)}</strong></div><div><small>Status</small><strong>${esc(labels[t.status])}</strong></div></div><h3>The brief</h3><p class="preserve">${esc(t.description)}</p>${tags(t.skills)}<div class="notice">Agree the work and payment terms with the business before starting. Payments are not processed or guaranteed by SkillBridge.</div>${!user ? '<button class="button primary full" id="apply-signin">Sign in to apply ↗</button>' : user.role === "business" ? '<div class="notice">You’re signed in as a business. Talent accounts apply for tasks.</div>' : already ? `<div class="notice">You already applied. Find this task in My projects.</div>` : t.status === "open" ? '<form id="apply-form"><label>Why are you a good fit?<textarea name="pitch" rows="4" required minlength="20" maxlength="2500" placeholder="Share the experience and skills you would bring to this task…"></textarea></label><button class="button primary full" type="submit">Send application ↗</button></form>' : '<div class="notice">This task is no longer accepting applications.</div>'}<button class="text-button report-link" id="report-task">Report this task</button>`,
    );
    document
      .querySelector("#apply-signin")
      ?.addEventListener("click", () => authModal("login"));
    document.querySelector("#report-task").onclick = () => report("task", id);
    const form = document.querySelector("#apply-form");
    if (form)
      handleForm(form, async (data) => {
        await api("/tasks/" + id + "/applications", {
          method: "POST",
          body: data,
        });
        closeModal();
        await navigate("projects");
        toast("Application sent. The business can now review it.");
      });
  } catch (e) {
    toast(e.message);
  }
}
function postTask() {
  if (!user) return authModal("register");
  if (user.role !== "business")
    return (
      modal(
        "Tasks are posted by business accounts",
        `<p>You’re signed in as talent. Sign out and use a separate business account to post work and review applications.</p><button class="button secondary" id="open-profile">View my profile ↗</button>`,
      ),
      (document.querySelector("#open-profile").onclick = () =>
        navigate("profile"))
    );
  modal(
    "Give local talent a fresh start.",
    `<p>A clear brief helps the right person take their next step.</p><form id="post-form"><label>Task title<input name="title" required minlength="8" maxlength="120" placeholder="e.g. Create our first social media content pack"/></label><label>Category<select name="category">${categories.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label><label>The brief<textarea name="description" required minlength="30" maxlength="4000" rows="4" placeholder="Describe deliverables, acceptance criteria and payment terms."></textarea></label><div class="form-grid"><label>Budget (ZAR)<input name="budget" type="number" required min="100" max="1000000" step="1"/></label><label>Delivery deadline<input name="deadline" type="date" required min="${new Date().toISOString().slice(0, 10)}"/></label></div><label>Required skills<input name="skills" required placeholder="Canva, Social media, Copywriting"/><small>Separate with commas. Matching uses these exact skill names.</small></label><div class="notice">Do not request unpaid trial work or include private customer data. Payment is arranged directly between the participants.</div><button class="button primary full" type="submit">Publish task ↗</button></form>`,
  );
  handleForm(document.querySelector("#post-form"), async (data) => {
    await api("/tasks", {
      method: "POST",
      body: {
        ...data,
        budget: Number(data.budget),
        skills: skillList(data.skills),
      },
    });
    closeModal();
    await navigate("projects");
    toast("Task published. Talent can now apply.");
  });
}
function projectDetail(id) {
  const a = projects.find((a) => a.id === id);
  if (!a) return;
  const talent = user.role === "talent";
  modal(
    a.title,
    `<div class="project-detail-header"><span>${esc(talent ? a.business_name : a.talent_name)}</span>${status(a.status)}</div><p>${money(a.budget)} · Due ${date(a.deadline)}</p>${!talent && a.share_public ? `<a class="work-link" href="/passport/${esc(a.passport_token)}" target="_blank" rel="noopener noreferrer">View applicant’s public passport ↗</a>` : ""}<h3>The brief</h3><p class="preserve">${esc(a.description)}</p><h3>Application</h3><p class="preserve">${esc(a.pitch)}</p>${a.submission ? `<h3>Latest submitted work</h3><p class="preserve">${esc(a.submission)}</p>${link(a.work_url)}` : ""}${a.feedback ? `<div class="notice"><strong>Business feedback</strong><br/>${esc(a.feedback)}</div>` : ""}${!talent && a.status === "applied" ? `<form id="select-form"><div class="notice">Selecting this applicant assigns the task and marks other applicants as not selected.</div><button class="button primary full" type="submit">Select this applicant ↗</button></form>` : ""}${talent && ["assigned", "changes_requested"].includes(a.status) ? `<form id="submit-form"><label>Submission summary<textarea name="submission" required minlength="20" maxlength="4000" rows="4" placeholder="Explain what you completed and how it meets the brief.">${esc(a.submission)}</textarea></label><label>Work link<input name="workUrl" type="url" required maxlength="1000" value="${esc(a.work_url)}" placeholder="https://…"/><small>Use a link the business can access. Check its sharing permissions.</small></label><label class="checkbox-label"><input name="publicConsent" type="checkbox" ${a.public_consent ? "checked" : ""}/> After approval, allow this work, brief and business feedback on my public passport.</label><button class="button primary full" type="submit">Submit for review ↗</button></form>` : ""}${!talent && a.status === "submitted" ? `<form id="review-form"><label>Your feedback<textarea name="feedback" required minlength="10" maxlength="2000" rows="3" placeholder="Describe what was delivered well, or the changes needed."></textarea></label><label>Decision<select name="action"><option value="approve">Approve completed work</option><option value="changes">Request changes</option></select></label><button class="button primary full" type="submit">Save review ↗</button></form>` : ""}${a.status === "completed" ? '<div class="success-panel">✓ Business-approved work. This project is recorded in the talent’s passport.</div>' : ""}<details class="history"><summary>Project history · ${a.events.length} updates</summary>${a.events.map((e) => `<div class="history-event"><strong>${esc(e.action)}</strong><small>${esc(e.actor_name)} · ${fullDate(e.created_at)}</small><p class="preserve">${esc(e.detail)}</p></div>`).join("")}</details>`,
  );
  const select = document.querySelector("#select-form");
  if (select)
    handleForm(select, async () => {
      await api("/applications/" + id + "/select", { method: "POST" });
      await refreshProject(id);
      toast("Talent selected. They can now submit work.");
    });
  const submit = document.querySelector("#submit-form");
  if (submit)
    handleForm(submit, async (data) => {
      await api("/applications/" + id + "/submit", {
        method: "POST",
        body: { ...data, publicConsent: data.publicConsent === "on" },
      });
      await refreshProject(id);
      toast("Work submitted to the business for review.");
    });
  const review = document.querySelector("#review-form");
  if (review)
    handleForm(review, async (data) => {
      await api("/applications/" + id + "/review", {
        method: "POST",
        body: data,
      });
      await refreshProject(id);
      toast(
        data.action === "approve"
          ? "Work approved. The passport now records this project."
          : "Changes requested. Talent can update the submission.",
      );
    });
}
async function refreshProject(id) {
  await navigate("projects");
  projectDetail(id);
}
function evidenceForm(existing) {
  const e = existing;
  modal(
    e ? "Update your experience." : "Your experience counts.",
    `<p>${e ? "Editing the details creates a new version. Current confirmations become previous-version records and must be requested again." : "Describe work you actually did. A work link is optional; a clear description and contact confirmation can also support your record."}</p><form id="evidence-form"><label>Experience title<input name="title" required minlength="5" maxlength="120" value="${esc(e?.title || "")}" placeholder="e.g. Managed stock records at a local shop"/></label><label>Business or context<input name="organisation" required minlength="2" maxlength="100" value="${esc(e?.organisation || "")}" placeholder="e.g. Neighbourhood shop / family business"/></label><label>When did you do this work?<input name="period" required minlength="3" maxlength="100" value="${esc(e?.period || "")}" placeholder="e.g. January–June 2026"/></label><label>What did you do?<textarea name="description" required minlength="20" maxlength="3000" rows="4" placeholder="Describe your responsibilities and what you produced.">${esc(e?.description || "")}</textarea></label><label>Skills demonstrated<input name="skills" required value="${esc(e?.skills.join(", ") || "")}" placeholder="Stock capture, Excel, Administration"/></label><label>Work link (optional)<input name="workUrl" type="url" maxlength="1000" value="${esc(e?.work_url || "")}" placeholder="https://…"/><small>Link to a work sample or photo/video you host. Use materials you have permission to share.</small></label><label class="checkbox-label"><input name="publicConsent" type="checkbox" ${e?.public_consent ? "checked" : ""}/> Allow this entry, work link and current confirmations on my public passport when sharing is enabled.</label><div class="notice">Keep identity documents, customer details and other private information out of public work samples.</div><button class="button primary full" type="submit">${e ? "Save new version" : "Add experience"} ↗</button></form>`,
  );
  handleForm(document.querySelector("#evidence-form"), async (data) => {
    await api("/evidence" + (e ? "/" + e.id : ""), {
      method: e ? "PUT" : "POST",
      body: {
        ...data,
        skills: skillList(data.skills),
        publicConsent: data.publicConsent === "on",
      },
    });
    closeModal();
    await navigate("passport");
    toast(
      e
        ? "New version saved. Request fresh confirmations for changed work."
        : "Experience added. You can now request a confirmation.",
    );
  });
}
function requestConfirmation(id) {
  modal(
    "Ask someone who knows your work.",
    `<p>Your contact needs their own SkillBridge account. They’ll find the request under <strong>Confirmations</strong> when they sign in.</p><form id="request-form"><label>Your contact’s sign-in email<input name="email" type="email" required maxlength="254" placeholder="contact@example.com"/></label><div class="notice">No email is sent. Tell your contact to sign in and open Confirmations. They will see this entry’s details and work link, even if it is private.</div><button class="button primary full" type="submit">Request confirmation ↗</button></form>`,
  );
  handleForm(document.querySelector("#request-form"), async (data) => {
    await api("/evidence/" + id + "/requests", { method: "POST", body: data });
    closeModal();
    await navigate("passport");
    toast("Request saved. Your contact can respond from their account.");
  });
}
function respondConfirmation(id) {
  const c = confirmations.find((c) => c.id === id);
  modal(
    "Confirm what you directly know.",
    `<p>${esc(c.talent_name)} described <strong>${esc(c.title)}</strong> at ${esc(c.organisation)}.</p><p class="preserve">${esc(c.description)}</p><form id="respond-form"><label>Your relationship to this work<input name="relationship" required minlength="3" maxlength="100" placeholder="e.g. Supervisor at the shop"/></label><label>Your statement<textarea name="statement" required minlength="10" maxlength="1500" rows="4" placeholder="Describe what you directly observed. Do not confirm work you cannot vouch for."></textarea></label><label>Decision<select name="action"><option value="confirm">Confirm this experience</option><option value="decline">Decline confirmation</option></select></label><div class="notice">Your name, relationship, statement and response time are recorded. Confirmed statements may be shown publicly if the owner shares this entry. You can withdraw your confirmation later.</div><label class="checkbox-label"><input type="checkbox" required/> I understand how my statement may be shared and will respond truthfully.</label><button class="button primary full" type="submit">Save response ↗</button></form>`,
  );
  handleForm(document.querySelector("#respond-form"), async (data) => {
    await api("/confirmations/" + id + "/respond", {
      method: "POST",
      body: data,
    });
    closeModal();
    await navigate("confirmations");
    toast("Your response has been recorded.");
  });
}
function confirmAction(title, message, action) {
  modal(
    title,
    `<p>${esc(message)}</p><form id="confirm-action"><button class="button primary full" type="submit">Confirm</button></form>`,
  );
  handleForm(document.querySelector("#confirm-action"), async () => {
    await action();
    closeModal();
  });
}
function deleteEvidence(id) {
  confirmAction(
    "Delete this experience?",
    "This removes the entry and its confirmation history. It will no longer appear on your public passport.",
    async () => {
      await api("/evidence/" + id, { method: "DELETE" });
      await navigate("passport");
      toast("Experience removed.");
    },
  );
}
async function visibility(type, id, isPublic) {
  try {
    await api("/" + type + "/" + id + "/visibility", {
      method: "PUT",
      body: { publicConsent: isPublic },
    });
    await navigate("passport");
    toast(
      isPublic ? "Entry selected for public sharing." : "Entry is now private.",
    );
  } catch (e) {
    toast(e.message);
  }
}
async function loadQR() {
  try {
    const { qrDataUrl } = await api("/passport/qr");
    const root = document.querySelector("#qr-container");
    if (root)
      root.innerHTML = `<img src="${esc(qrDataUrl)}" alt="QR code linking to your public skills passport" width="180" height="180"/><small>Scan to view your public passport</small>`;
  } catch (e) {
    const root = document.querySelector("#qr-container");
    if (root) root.textContent = e.message;
  }
}
function report(type, id) {
  if (!user)
    return modal(
      "Sign in to report a concern",
      `<p>Reporting uses an account so the team can follow up. Open the app and sign in, then return to this passport.</p><a class="button primary" href="/">Open SkillBridge ↗</a>`,
    );
  modal(
    "Report a concern",
    `<p>Reports are stored for the hackathon team to review. They are not monitored in real time.</p><form id="report-form"><label>What concerns you?<textarea name="reason" required minlength="15" maxlength="2000" rows="4" placeholder="Describe the issue without including sensitive personal information."></textarea></label><button class="button primary full" type="submit">Submit report</button></form>`,
  );
  handleForm(document.querySelector("#report-form"), async (data) => {
    const result = await api("/reports", {
      method: "POST",
      body: { ...data, targetType: type, targetId: id },
    });
    closeModal();
    toast(`Report recorded. Reference: ${result.id.slice(0, 8)}.`);
  });
}
window.addEventListener("hashchange", () => {
  if (!publicToken) navigate(location.hash.slice(1));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    document.querySelector("#search")?.focus();
  }
  const dialog = document.querySelector(".modal");
  if (e.key === "Tab" && dialog) {
    const all = [
      ...dialog.querySelectorAll(
        "button:not([disabled]),input,select,textarea,a[href],summary",
      ),
    ];
    if (e.shiftKey && document.activeElement === all[0]) {
      e.preventDefault();
      all.at(-1).focus();
    } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
      e.preventDefault();
      all[0].focus();
    }
  }
});
async function boot() {
  app.innerHTML = shell(
    '<div class="loading" role="status">Getting your workspace ready…</div>',
  );
  try {
    user = (await api("/me")).user;
    if (publicToken) {
      try {
        await loadView();
      } catch {
        publicPassport = null;
      }
      render();
    } else await navigate(view);
  } catch (e) {
    app.innerHTML = `<main class="startup-error"><h1>Let’s get you connected.</h1><p>${esc(e.message)}</p><p>If you’re developing locally, start the API with <code>npm run dev:server</code> in a second terminal.</p><button class="button primary" id="reload">Try again</button></main>`;
    document.querySelector("#reload").onclick = boot;
  }
}
boot();
