import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultConfig, freshBook, fromCents, cents } from "./engine.ts";
import type { Book, Config } from "./types.ts";

type DeskState = Book & {
  config: Config;
  autopilot: boolean;
  setConfig: (patch: Partial<Config>) => void;
  setAutopilot: (on: boolean) => void;
  replaceBook: (book: Book) => void;
  beginSession: (day: string) => void;
  resetBook: () => void;
};

export const useDesk = create<DeskState>()(
  persist(
    (set) => ({
      ...freshBook(),
      config: defaultConfig(),
      autopilot: false,
      setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
      setAutopilot: (autopilot) => set({ autopilot }),
      replaceBook: (book) => set(book),
      beginSession: (day) =>
        set((state) => {
          let cash = cents(state.cash);
          const closed = [...state.closed];
          for (const pos of state.positions) {
            cash += pos.qty * cents(pos.entry);
            closed.unshift({
              id: pos.id,
              symbol: pos.symbol,
              qty: pos.qty,
              entry: pos.entry,
              exit: pos.entry,
              reason: "scratch",
              pnl: 0,
              day: pos.day,
            });
          }
          return {
            cash: fromCents(cash),
            positions: [],
            closed: closed.slice(0, 30),
            tradesToday: 0,
            riskUsed: 0,
            skipped: [],
            bookDay: day,
          };
        }),
      resetBook: () =>
        set((state) => ({
          ...freshBook(state.config.budget),
          config: state.config,
          autopilot: state.autopilot,
        })),
    }),
    {
      name: "pit-paper-desk",
      skipHydration: true,
      partialize: (state) => ({
        cash: state.cash,
        positions: state.positions,
        closed: state.closed,
        tradesToday: state.tradesToday,
        riskUsed: state.riskUsed,
        bookDay: state.bookDay,
        skipped: state.skipped,
        log: state.log,
        seq: state.seq,
        config: state.config,
        autopilot: state.autopilot,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<DeskState>;
        return {
          ...current,
          ...saved,
          config: { ...current.config, ...saved.config, symbols: saved.config?.symbols?.length ? saved.config.symbols : current.config.symbols },
          positions: saved.positions ?? [],
          closed: saved.closed ?? [],
          log: saved.log ?? [],
          skipped: saved.skipped ?? [],
        };
      },
    },
  ),
);
