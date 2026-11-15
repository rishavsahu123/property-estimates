// Google sign-in and Google Drive backup (like WhatsApp): on by default after sign-in, can be turned off,
// Daily / Weekly / Monthly / Only when I tap, Wi-Fi only, Back up now, last backup, restore on a new phone.
// Uses only the drive.file permission: the app sees just the files it made, nothing else in the user's Drive.
import { DRIVE_FOLDER, DRIVE_KEEP, GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from "../lib/config";
import { fdate } from "../lib/format";
import { D } from "../state";
import * as dom from "../ui/dom";
import * as sheets from "../ui/sheets";
import * as backup from "./backup";
import * as files from "./files";
import * as home from "./home";

// typed views of the screen modules (they are still plain JS-style, being converted one by one)
interface Sheet { body: HTMLElement; refresh: (() => void) | null; onClose: (() => void) | null; close(fromBack?: boolean): void }
const $ = dom.$ as unknown as (s: string, r?: ParentNode) => HTMLElement | null;
const $$ = dom.$$ as unknown as (s: string, r?: ParentNode) => HTMLElement[];
const lget = dom.lget as unknown as <T>(k: string, d: T) => T;
const lset = dom.lset as unknown as (k: string, v: unknown) => void;
const toast = dom.toast as unknown as (msg: string, act?: { label: string; fn: () => void }) => void;
const ask = (title: string, msg: string, o?: { ok?: string; cancel?: string; danger?: boolean }): Promise<boolean> => (sheets.ask as unknown as typeof ask)(title, msg, o);
const openSheet = (title: string, html: string): Sheet => (sheets.openSheet as unknown as (t: string, h: string) => Sheet)(title, html);
const buildBackupJSON = (): Promise<string> => (backup.buildBackupJSON as unknown as () => Promise<string>)();
const restoreData = (d: unknown, o?: { from?: string }): Promise<boolean> => (backup.restoreData as unknown as typeof restoreData)(d, o);
const fsize = (b: number): string => (files.fsize as unknown as (b: number) => string)(b);
const backupNote = (): void => (home.backupNote as unknown as () => void)();

export type Freq = "daily" | "weekly" | "monthly" | "manual";
export interface DriveState {
  email: string | null;
  name: string | null;
  on: boolean;
  freq: Freq;
  wifiOnly: boolean;
  last: { at: number; size: number } | null;
  folderId: string | null;
}
interface DriveFile { id: string; name: string; size?: string; createdTime?: string }
interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string; hint?: string }): void }
declare global {
  interface Window { google?: { accounts: { oauth2: {
    initTokenClient(o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: unknown) => void }): TokenClient;
    revoke(token: string, done?: () => void): void;
  } } } }
}

const KEY = "pe-drive";
const PERIOD: Record<Exclude<Freq, "manual">, number> = { daily: 864e5, weekly: 7 * 864e5, monthly: 30 * 864e5 };
export const FREQ_LABEL: Record<Freq, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", manual: "Only when I tap" };

const blank = (): DriveState => ({ email: null, name: null, on: true, freq: "daily", wifiOnly: false, last: null, folderId: null });
export const driveState = (): DriveState => ({ ...blank(), ...lget<Partial<DriveState>>(KEY, {}) });
const saveState = (p: Partial<DriveState>): DriveState => { const s = { ...driveState(), ...p }; lset(KEY, s); return s; };

// ---------- access token (Google Identity Services, token flow) ----------
let token: { v: string; until: number } | null = null;
try { const t = JSON.parse(sessionStorage.getItem("pe-drive-t") || "null"); if (t && t.until > Date.now()) token = t; } catch { /* private mode */ }
const hasToken = () => !!token && token.until > Date.now() + 60_000;

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoading) gisLoading = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => res(); s.onerror = () => { gisLoading = null; rej(new Error("gis")); };
    document.head.appendChild(s);
  });
  return gisLoading;
}
/** asks Google for a token. Must run from a tap (it may open Google's small window). */
async function getToken(interactive: boolean): Promise<string> {
  if (hasToken()) return token!.v;
  if (!interactive) throw new Error("needs-tap");
  await loadGis();
  const st = driveState();
  return new Promise((res, rej) => {
    const c = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: GOOGLE_SCOPES,
      callback: r => {
        if (!r.access_token) { rej(new Error(r.error || "denied")); return; }
        token = { v: r.access_token, until: Date.now() + (r.expires_in || 3600) * 1000 };
        try { sessionStorage.setItem("pe-drive-t", JSON.stringify(token)); } catch { /* ignore */ }
        res(token.v);
      },
      error_callback: () => rej(new Error("closed")),
    });
    c.requestAccessToken(st.email ? { prompt: "", hint: st.email } : { prompt: "consent" });
  });
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const t = await getToken(false);
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.headers || {}) } });
  if (r.status === 401) { token = null; throw new Error("needs-tap"); }
  if (!r.ok) throw new Error(`drive ${r.status}`);
  return (r.status === 204 ? null : init.method === "DELETE" ? null : await r.json()) as T;
}
const DRV = "https://www.googleapis.com/drive/v3";
const q = (s: string) => encodeURIComponent(s);

async function folderId(): Promise<string> {
  const st = driveState();
  if (st.folderId) return st.folderId;
  const found = await api<{ files: DriveFile[] }>(`${DRV}/files?q=${q(`name='${DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)&spaces=drive`);
  const id = found.files[0]?.id || (await api<DriveFile>(`${DRV}/files?fields=id`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: DRIVE_FOLDER, mimeType: "application/vnd.google-apps.folder" }),
  })).id;
  saveState({ folderId: id });
  return id;
}
export async function listBackups(): Promise<DriveFile[]> {
  const f = await folderId();
  const r = await api<{ files: DriveFile[] }>(`${DRV}/files?q=${q(`'${f}' in parents and trashed=false`)}&orderBy=createdTime desc&fields=files(id,name,size,createdTime)&spaces=drive`);
  return r.files;
}

let running = false;
/** builds the backup, uploads it to the folder, keeps the latest few. */
export async function backupNow({ interactive = true, quiet = false } = {}): Promise<boolean> {
  if (running) return false;
  running = true;
  try {
    await getToken(interactive);
    if (!quiet) toast("Backing up to Google Drive…");
    const body = await buildBackupJSON(), f = await folderId();
    const d = new Date(), pad = (n: number) => String(n).padStart(2, "0");
    const name = `property-estimates-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    // resumable upload: works for big backups with many photos
    const t = await getToken(false);
    const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size", {
      method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "application/json" },
      body: JSON.stringify({ name, parents: [f], mimeType: "application/json" }),
    });
    if (start.status === 401) { token = null; throw new Error("needs-tap"); }
    const loc = start.headers.get("Location");
    if (!start.ok || !loc) throw new Error("upload-start");
    const up = await fetch(loc, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
    if (!up.ok) throw new Error("upload");
    const size = new Blob([body]).size;
    saveState({ last: { at: Date.now(), size } });
    lset("ghk-backup", Date.now());
    // keep only the latest few
    const all = await listBackups();
    for (const old of all.slice(DRIVE_KEEP)) await api(`${DRV}/files/${old.id}`, { method: "DELETE" }).catch(() => {});
    backupNote(); paintDueBar();
    if (!quiet) toast(`Backed up to Google Drive · ${fsize(size)}`);
    return true;
  } catch (err) {
    const m = (err as Error).message;
    if (m === "needs-tap") { paintDueBar(); if (!quiet) toast("Tap Back up now to sign in again"); }
    else if (m === "closed" || m === "denied" || m === "access_denied") { if (!quiet) toast("Google sign-in was closed"); }
    else { console.error(err); if (!quiet) toast(m === "gis" ? "Couldn’t reach Google. Check the internet and try again." : "Couldn’t back up to Google Drive. Try again."); }
    return false;
  } finally { running = false; }
}

/** is an automatic backup due now? */
export function isDue(st = driveState()): boolean {
  if (!st.email || !st.on || st.freq === "manual") return false;
  if (!st.last) return true;
  return Date.now() - st.last.at >= PERIOD[st.freq];
}
const onWifiOrUnknown = () => {
  const c = (navigator as Navigator & { connection?: { type?: string } }).connection;
  return !c || !c.type || c.type === "wifi" || c.type === "ethernet" || c.type === "unknown";
};
/** runs when the app opens or comes back: backs up quietly when Google still trusts this session, otherwise shows a one-tap bar */
export async function autoBackup(): Promise<void> {
  const st = driveState();
  if (!isDue(st) || !navigator.onLine) { paintDueBar(); return; }
  if (st.wifiOnly && !onWifiOrUnknown()) { paintDueBar(); return; }
  if (hasToken()) { await backupNow({ interactive: false, quiet: true }); return; }
  paintDueBar();
}
/** "Drive backup is due · Back up now" bar on Home (one tap = Google may need the tap to confirm) */
export function paintDueBar(): void {
  const bar = $("#drivedue") as HTMLElement | null; if (!bar) return;
  const st = driveState(), due = isDue(st) && !(st.wifiOnly && !onWifiOrUnknown());
  bar.hidden = !due;
  if (due) {
    bar.innerHTML = `<span>${st.last ? `Google Drive backup is due (last ${fdate(st.last.at)}).` : "First Google Drive backup is due."}</span><button class="linkbtn" id="dd-go">Back up now</button>`;
    $("#dd-go")!.addEventListener("click", () => { void backupNow(); });
  }
}

async function signIn(): Promise<boolean> {
  try {
    token = null;
    const t = await getToken(true);
    const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${t}` } }).then(r => r.ok ? r.json() : {}) as { email?: string; name?: string };
    saveState({ email: me.email || "Google account", name: me.name || null, folderId: null });
    toast(`Signed in as ${me.email || "your Google account"}`);
    return true;
  } catch (err) {
    const m = (err as Error).message;
    toast(m === "gis" ? "Couldn’t reach Google. Check the internet and try again." : "Google sign-in was closed");
    return false;
  }
}
function signOut(): void {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token.v);
  token = null; try { sessionStorage.removeItem("pe-drive-t"); } catch { /* ignore */ }
  const st = driveState(); lset(KEY, { ...blank(), freq: st.freq, wifiOnly: st.wifiOnly, on: st.on });
  paintDueBar(); toast("Signed out of Google. Nothing more is uploaded.");
}

async function restoreFromDrive(s: Sheet): Promise<void> {
  try {
    await getToken(true);
    const files = await listBackups();
    if (!files.length) { toast("No backups in your Google Drive yet"); return; }
    const pick = files[0];
    const when = pick.createdTime ? fdate(new Date(pick.createdTime)) : pick.name;
    const t = await getToken(false);
    const r = await fetch(`${DRV}/files/${pick.id}?alt=media`, { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) throw new Error("get");
    const data = await r.json();
    const done = await restoreData(data, { from: `Google Drive backup from ${when}${pick.size ? `, ${fsize(+pick.size)}` : ""}` });
    if (done && s.refresh) s.refresh();
  } catch (err) { console.error(err); toast("Couldn’t read the backup from Google Drive. Try again."); }
}

/** Settings → Google Drive backup */
export function openDrive(): void {
  const s = openSheet("Google Drive backup", "");
  const paint = () => {
    const st = driveState();
    if (!st.email) {
      s.body.innerHTML = `<p class="pmeta" style="margin:0">Keep a copy of everything in your own Google Drive, so your records are safe even if this phone is lost or reset.</p>
        <ul class="dlist"><li>Only files made by this app: it can’t see anything else in your Drive.</li><li>Backups go to a folder named “${DRIVE_FOLDER}”. You can see and download them anytime.</li><li>Free: it uses your own Google storage.</li></ul>
        <button class="primary" id="dr-in">Sign in with Google</button>`;
      $("#dr-in", s.body)!.addEventListener("click", async () => {
        if (!(await signIn())) return;
        paint();
        // a new phone with no payments: offer the latest Drive backup straight away
        if (!D.entries.length) { try { const f = await listBackups(); if (f.length && await ask("Restore your Google Drive backup?", `Found a backup from ${f[0].createdTime ? fdate(new Date(f[0].createdTime)) : "earlier"}.`, { ok: "Restore" })) await restoreFromDrive(s); } catch { /* ignore */ } }
        else if (driveState().on) { if (await backupNow()) paint(); }
      });
      return;
    }
    s.body.innerHTML = `<div class="who"><b>${st.name ? st.name + " · " : ""}${st.email}</b><button class="linkbtn" id="dr-out">Sign out</button></div>
      <label class="check"><input type="checkbox" id="dr-on"${st.on ? " checked" : ""}>Back up to Google Drive</label>
      <div id="dr-opts"${st.on ? "" : " hidden"}>
        <span class="lbl">Back up automatically</span>
        <div class="chips">${(Object.keys(FREQ_LABEL) as Freq[]).map(k => `<button type="button" class="chip" data-fq="${k}" aria-pressed="${k === st.freq}">${FREQ_LABEL[k]}</button>`).join("")}</div>
        <label class="check"><input type="checkbox" id="dr-wifi"${st.wifiOnly ? " checked" : ""}>Only on Wi-Fi</label>
      </div>
      <div class="sumstrip"><div>Last backup<span style="display:block;font-size:15px;margin-top:6px">${st.last ? fdate(st.last.at) : "Not yet"}</span></div><div>Size<span style="display:block;font-size:15px;margin-top:6px">${st.last ? fsize(st.last.size) : "—"}</span></div><div>Keeps<span style="display:block;font-size:15px;margin-top:6px">latest ${DRIVE_KEEP}</span></div></div>
      <button class="primary" id="dr-now"${st.on ? "" : " disabled"}>Back up now</button>
      <button class="second" id="dr-res">Restore from Google Drive</button>
      <p class="hint">${st.on ? (st.freq === "manual" ? "Backs up only when you tap Back up now." : `Backs up ${FREQ_LABEL[st.freq].toLowerCase()} when you open the app${st.wifiOnly ? " on Wi-Fi" : ""}. If Google asks you to confirm, a bar on the Home screen shows Back up now.`) : "Backup is off. Nothing is uploaded."}</p>`;
    $("#dr-out", s.body)!.addEventListener("click", async () => { if (await ask("Sign out of Google?", "Backups already in your Drive stay there. Nothing new is uploaded.", { ok: "Sign out" })) { signOut(); paint(); } });
    ($("#dr-on", s.body) as HTMLInputElement).addEventListener("change", e => { saveState({ on: (e.target as HTMLInputElement).checked }); paintDueBar(); paint(); });
    ($("#dr-wifi", s.body) as HTMLInputElement).addEventListener("change", e => { saveState({ wifiOnly: (e.target as HTMLInputElement).checked }); paintDueBar(); paint(); });
    $$("[data-fq]", s.body).forEach(b => b.addEventListener("click", () => { saveState({ freq: (b as HTMLElement).dataset.fq as Freq }); paintDueBar(); paint(); }));
    $("#dr-now", s.body)!.addEventListener("click", async () => { if (await backupNow()) paint(); });
    $("#dr-res", s.body)!.addEventListener("click", () => { void restoreFromDrive(s); });
  };
  s.refresh = paint; paint();
}

/** short line for Settings */
export function driveSummary(): string {
  const st = driveState();
  if (!st.email) return "Off · sign in to keep a copy in your Google Drive";
  if (!st.on) return `${st.email} · backup off`;
  return `${st.email} · ${FREQ_LABEL[st.freq]}${st.last ? ` · last ${fdate(st.last.at)}` : ""}`;
}
