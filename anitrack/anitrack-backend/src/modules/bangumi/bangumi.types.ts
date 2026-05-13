/** Bangumi `/calendar` bucket (defensive; upstream shape may evolve). */
export type BangumiCalendarWeekday = {
  id?: number;
  cn?: string;
  en?: string;
  ja?: string;
};

export type BangumiCalendarItem = {
  id?: number;
  name?: string;
  name_cn?: string;
  name_en?: string;
  air_date?: string;
  air_weekday?: number;
  /** e.g. "23:00" */
  time?: string;
  eps?: number;
  /** image url */
  image?: string;
};

export type BangumiCalendarDay = {
  weekday?: BangumiCalendarWeekday;
  items?: BangumiCalendarItem[];
};
