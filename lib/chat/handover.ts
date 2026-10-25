export type HandoverSnapshot = {
  mine: boolean;
  theirs: boolean;
  completedAt: string | null;
  from: string;
  to: string;
  date: string;
  firstMoment?: boolean;
};
export type HandoverResult = {
  handover?: HandoverSnapshot;
  error?: string;
  warning?: string;
};
