import { ApiError, errorMessage, type ApiOptions } from "../../lib/api/client";
import type { TrendsPage } from "./types";

export type TrendListState = {
  page: TrendsPage | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
};
type Request = (
  path: `/${string}`,
  options?: ApiOptions,
) => Promise<TrendsPage>;
const empty = (): TrendListState => ({
  page: null,
  loading: false,
  error: null,
  notice: null,
});

// Bir örnek tek hesap/filtre kümesine aittir. Eski istekler ve kapanan ekran
// yeni kesite veri ekleyemez; 409'da tüm eski sayfalar hemen kaldırılır.
export class TrendList {
  private state = empty();
  private listeners = new Set<() => void>();
  private revision = 0;
  private controller: AbortController | null = null;
  private pending = false;
  constructor(
    private readonly request: Request,
    private readonly path: `/${string}`,
  ) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(value: TrendListState) {
    this.state = value;
    this.listeners.forEach((listener) => listener());
  }
  cancel = () => {
    ++this.revision;
    this.controller?.abort();
    this.pending = false;
    this.update(empty());
  };
  refresh = () => this.load(true);
  loadMore = () => this.load(false);
  private async load(reset: boolean) {
    if (!reset && (this.pending || !this.state.page?.nextCursor)) return;
    if (reset) {
      ++this.revision;
      this.controller?.abort();
    }
    const revision = this.revision;
    const controller = new AbortController();
    this.controller = controller;
    this.pending = true;
    const previous = reset ? null : this.state.page;
    this.update({ page: previous, loading: true, error: null, notice: null });
    const cursor = previous?.nextCursor;
    try {
      const page = await this.request(
        cursor
          ? `${this.path}&cursor=${encodeURIComponent(cursor)}`
          : this.path,
        { signal: controller.signal },
      );
      if (revision !== this.revision || controller.signal.aborted) return;
      const items = previous ? [...previous.items, ...page.items] : page.items;
      this.update({
        page: {
          ...page,
          items: [...new Map(items.map((item) => [item.id, item])).values()],
        },
        loading: false,
        error: null,
        notice: null,
      });
    } catch (error) {
      if (revision !== this.revision || controller.signal.aborted) return;
      if (
        error instanceof ApiError &&
        ["TREND_RESULTS_CHANGED", "TREND_PAGE_EXPIRED"].includes(error.code)
      ) {
        this.update({
          page: null,
          loading: true,
          error: null,
          notice: "Liste güncellendi; sonuçlar yeniden yükleniyor.",
        });
        try {
          const page = await this.request(this.path, {
            signal: controller.signal,
          });
          if (revision === this.revision && !controller.signal.aborted)
            this.update({
              page,
              loading: false,
              error: null,
              notice: "Güncel sonuçlar gösteriliyor.",
            });
        } catch (failure) {
          if (revision === this.revision && !controller.signal.aborted)
            this.update({
              page: null,
              loading: false,
              error: errorMessage(failure),
              notice: null,
            });
        }
      } else {
        this.update({
          page: null,
          loading: false,
          error: errorMessage(error),
          notice: null,
        });
      }
    } finally {
      if (revision === this.revision) this.pending = false;
    }
  }
}
