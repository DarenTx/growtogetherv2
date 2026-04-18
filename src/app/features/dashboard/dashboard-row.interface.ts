export interface DashboardRow {
  profileId: string;
  firstName: string;
  lastName: string;
  bankName: string;
  /** 12 elements, index 0 = Jan through index 11 = Dec. Null means no data. */
  months: (number | null)[];
}
