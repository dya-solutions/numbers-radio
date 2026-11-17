/**
 * PROGRAM GUIDE - starter schedule / safety net only.
 *
 * You no longer edit this file to change the schedule. Update it from the
 * website instead: sign in to /admin and open "Edit Program Guide".
 *
 * This list is only shown if the database cannot be reached.
 */

export interface ScheduleEntry {
  time: string;
  title: string;
  host?: string;
  description: string;
}

export interface ScheduleDay {
  /** A short description of when these programs air (only used internally). */
  label: string;
  /** Days of the week: 1 = Monday ... 7 = Sunday. */
  days: number[];
  entries: ScheduleEntry[];
}

export const weeklySchedule: ScheduleDay[] = [
  {
    label: "Weekday Mornings (Monday - Friday)",
    days: [1, 2, 3, 4, 5],
    entries: [
      {
        time: "06:00",
        title: "First Light",
        host: "with Grace Okafor",
        description: "Gentle worship and Scripture to begin the day.",
      },
      {
        time: "08:00",
        title: "The Morning Word",
        host: "with Pastor Daniel Reyes",
        description: "A short teaching and prayer over the day ahead.",
      },
      {
        time: "10:00",
        title: "Hymns & History",
        description: "Classic hymns and the stories behind them.",
      },
    ],
  },
  {
    label: "Weekday Afternoons (Monday - Friday)",
    days: [1, 2, 3, 4, 5],
    entries: [
      {
        time: "12:00",
        title: "Midday Rest",
        description: "Quiet instrumental worship for the lunch hour.",
      },
      {
        time: "15:00",
        title: "Every Soul Counts",
        host: "with the Numbers Radio team",
        description: "Listener stories, encouragement, and prayer requests.",
      },
      {
        time: "17:00",
        title: "Drive Home Praise",
        description: "Uplifting contemporary worship for the commute.",
      },
    ],
  },
  {
    label: "Evenings (Every Night)",
    days: [1, 2, 3, 4, 5, 6, 7],
    entries: [
      {
        time: "20:00",
        title: "Evening Prayer",
        description: "A guided time of prayer and reflection.",
      },
      {
        time: "22:00",
        title: "Through the Night",
        description: "Soft worship music until morning.",
      },
    ],
  },
  {
    label: "Sunday",
    days: [7],
    entries: [
      {
        time: "09:00",
        title: "Sunday Gathering",
        description: "A full worship service with teaching.",
      },
      {
        time: "18:00",
        title: "Songs of the Church",
        description: "Worship music from around the world.",
      },
    ],
  },
];
