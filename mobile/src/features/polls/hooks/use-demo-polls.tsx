import { createContext, useContext, useState, type ReactNode } from "react";
import type { DemoOption, DemoPost } from "../types";

type Label = DemoOption["label"];
type State = {
  votes: Record<string, Label>;
  saved: string[];
  vote: (id: string, label: Label) => void;
  toggleSave: (id: string) => void;
};
const Context = createContext<State | null>(null);

// Yalnız önizleme state'i; uygulama yeniden açılınca sıfırlanır, gerçek oy/hak değildir.
export function DemoPollsProvider({ children }: { children: ReactNode }) {
  const [votes, setVotes] = useState<Record<string, Label>>({});
  const [saved, setSaved] = useState<string[]>([]);
  function vote(id: string, label: Label) {
    setVotes((previous) =>
      previous[id] ? previous : { ...previous, [id]: label },
    );
  }
  function toggleSave(id: string) {
    setSaved((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  }
  return (
    <Context.Provider value={{ votes, saved, vote, toggleSave }}>
      {children}
    </Context.Provider>
  );
}
export function useDemoPolls() {
  const context = useContext(Context);
  if (!context) throw new Error("DemoPollsProvider gerekli.");
  return context;
}
export function demoResults(post: DemoPost, picked?: Label) {
  const total = post.totalVotes + (picked ? 1 : 0);
  const baseA = Math.round((post.totalVotes * post.options[0].percent) / 100);
  const votesA = baseA + (picked === "A" ? 1 : 0);
  const votesB = post.totalVotes - baseA + (picked === "B" ? 1 : 0);
  let percentageA = total ? Math.floor((votesA * 100) / total) : 0;
  let percentageB = total ? Math.floor((votesB * 100) / total) : 0;
  if (total && percentageA + percentageB < 100) {
    if ((votesA * 100) % total >= (votesB * 100) % total) percentageA++;
    else percentageB++;
  }
  return {
    total,
    options: post.options.map((option, index) => ({
      ...option,
      votes: index === 0 ? votesA : votesB,
      percent: index === 0 ? percentageA : percentageB,
    })),
  };
}
