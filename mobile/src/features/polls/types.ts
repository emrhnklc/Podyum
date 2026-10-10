import type { PollCategory } from "@/constants/poll-categories";

export type DemoOption = {
  label: "A" | "B";
  image?: string;
  video?: string;
  tone: string;
  productCount: number;
  percent: number;
};

export type DemoPost = {
  id: string;
  user: string;
  context: string;
  timeLeft: string;
  urgent: boolean;
  category: PollCategory;
  photoLabel: string;
  question: string;
  options: [DemoOption, DemoOption];
  totalVotes: number;
  commentCount: number;
  insight: string;
};
