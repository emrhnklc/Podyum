import { ApiError, type ApiOptions } from "../../lib/api/client";
import type { AuthMe, Session } from "./types";

type Transport = (path: `/${string}`, options?: ApiOptions) => Promise<Response>;
type Storage = { read: () => Promise<Session | null>; write: (value: Session | null) => Promise<void> };
export type AuthState = { ready: boolean; session: Session | null; me: AuthMe | null; error: string | null };

// Refresh tek uçuşta yapılır. Eski hesaptan geç gelen yanıtlar yeni oturuma taşınmaz.
export class SessionManager {
  state: AuthState = { ready: false, session: null, me: null, error: null };
  private listeners = new Set<() => void>();
  private revision = 0;
  private refreshFlight: Promise<Session> | null = null;
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly transport: Transport, private readonly storage: Storage) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private update(next: Partial<AuthState>) { this.state = { ...this.state, ...next }; this.listeners.forEach((fn) => fn()); }
  private persist(value: Session | null) {
    const work = this.writes.catch(() => {}).then(() => this.storage.write(value));
    this.writes = work;
    return work;
  }
  private unchanged(revision: number) {
    if (revision !== this.revision) throw new ApiError(401, "SESSION_CHANGED", "Oturum değişti. Tekrar giriş yap.");
  }
  async restore() {
    const revision = ++this.revision;
    this.update({ ready: false, error: null });
    try {
      const session = await this.storage.read(); this.unchanged(revision);
      if (!session) { this.update({ ready: true }); return; }
      this.update({ session });
      const me = await this.request<AuthMe>("/auth/me"); this.unchanged(revision);
      this.update({ me, ready: true });
    } catch (error) {
      if (revision !== this.revision) return;
      this.update({ ready: true, session: null, me: null, error: error instanceof ApiError ? error.message : "Oturum okunamadı. Yeniden giriş yapabilirsin." });
    }
  }
  async login(email: string, password: string) {
    const revision = ++this.revision;
    this.refreshFlight = null;
    this.update({ ready: true, session: null, me: null, error: null });
    await this.persist(null); this.unchanged(revision);
    const session: Session = await (await this.transport("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) })).json();
    this.unchanged(revision);
    const me: AuthMe = await (await this.transport("/auth/me", { accessToken: session.accessToken })).json();
    this.unchanged(revision);
    await this.persist(session); this.unchanged(revision);
    this.update({ ready: true, session, me, error: null });
  }
  private refresh() {
    if (this.refreshFlight) return this.refreshFlight;
    const previous = this.state.session, revision = this.revision;
    if (!previous) return Promise.reject(new ApiError(401, "INVALID_SESSION", "Giriş yapman gerekiyor."));
    const flight = (async () => {
      try {
        // Yenileme isteği ağ hatasında otomatik tekrarlanmaz: token tek kullanımlıktır.
        const next: Session = await (await this.transport("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: previous.refreshToken }) })).json();
        this.unchanged(revision);
        await this.persist(next); this.unchanged(revision);
        this.update({ session: next }); return next;
      } catch (error) {
        if (revision === this.revision) {
          ++this.revision;
          this.update({ session: null, me: null, ready: true, error: "Oturumun yenilenemedi. Lütfen yeniden giriş yap." });
          await this.persist(null).catch(() => {});
        }
        throw error;
      }
    })();
    this.refreshFlight = flight;
    void flight.finally(() => { if (this.refreshFlight === flight) this.refreshFlight = null; }).catch(() => {});
    return flight;
  }
  async response(path: `/${string}`, options: ApiOptions = {}) {
    const revision = this.revision;
    let session = this.state.session;
    if (!session) throw new ApiError(401, "INVALID_SESSION", "Giriş yapman gerekiyor.");
    if (Date.parse(session.accessExpiresAt) <= Date.now() + 30_000) session = await this.refresh();
    this.unchanged(revision);
    try {
      const response = await this.transport(path, { ...options, accessToken: session.accessToken });
      this.unchanged(revision); return response;
    } catch (error) {
      this.unchanged(revision);
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const latest = this.state.session;
      session = latest && latest.accessToken !== session.accessToken ? latest : await this.refresh();
      this.unchanged(revision);
      try {
        const response = await this.transport(path, { ...options, accessToken: session.accessToken });
        this.unchanged(revision); return response;
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401 && revision === this.revision) await this.logout(false);
        throw retryError;
      }
    }
  }
  async request<T>(path: `/${string}`, options: ApiOptions = {}): Promise<T> {
    const revision = this.revision;
    const response = await this.response(path, options);
    const value = response.status === 204 ? undefined as T : await response.json() as T;
    this.unchanged(revision);
    return value;
  }
  async logout(remote = true) {
    const token = this.state.session?.accessToken;
    ++this.revision; this.refreshFlight = null;
    this.update({ ready: true, session: null, me: null, error: null });
    await this.persist(null);
    if (remote && token) await this.transport("/auth/logout", { method: "POST", accessToken: token });
  }
}
