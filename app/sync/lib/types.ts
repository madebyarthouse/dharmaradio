export type Talk = {
  title: string;
  teacher: string;
  description: string | null;
  center: string | null;
  centerUrl: string | null;
  retreat: string | null;
  retreatUrl: string | null;
  date: string;
  time: string;
  audioUrl: string | null;
  talkId: number;
  teacherUrl: string | null;
};

export type ScrapedTalk = Talk & {
  centerSubdomain: string | null;
  retreatId: number | null;
};
