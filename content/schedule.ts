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
  day: string;
  entries: ScheduleEntry[];
}

export const weeklySchedule: ScheduleDay[] = [
  {
    day: "Weekday Mornings (Monday - Friday)",
    entries: [
      {
        time: "6:00 AM",
        title: "First Light",
        host: "with Grace Okafor",
        description: "Gentle worship and Scripture to begin the day.",
      },
      {
        time: "8:00 AM",
        title: "The Morning Word",
        host: "with Pastor Daniel Reyes",
        description: "A short teaching and prayer over the day ahead.",
      },
      {
        time: "10:00 AM",
        title: "Hymns & History",
        description: "Classic hymns and the stories behind them.",
      },
    ],
  },
  {
    day: "Weekday Afternoons (Monday - Friday)",
    entries: [
      {
        time: "12:00 PM",
        title: "Midday Rest",
        description: "Quiet instrumental worship for the lunch hour.",
      },
      {
        time: "3:00 PM",
        title: "Every Soul Counts",
        host: "with the Numbers Radio team",
        description: "Listener stories, encouragement, and prayer requests.",
      },
      {
        time: "5:00 PM",
        title: "Drive Home Praise",
        description: "Uplifting contemporary worship for the commute.",
      },
    ],
  },
  {
    day: "Evenings (Every Night)",
    entries: [
      {
        time: "8:00 PM",
        title: "Evening Prayer",
        description: "A guided time of prayer and reflection.",
      },
      {
        time: "10:00 PM",
        title: "Through the Night",
        description: "Soft worship music until morning.",
      },
    ],
  },
  {
    day: "Sunday",
    entries: [
      {
        time: "9:00 AM",
        title: "Sunday Gathering",
        description: "A full worship service with teaching.",
      },
      {
        time: "6:00 PM",
        title: "Songs of the Church",
        description: "Worship music from around the world.",
      },
    ],
  },
];
