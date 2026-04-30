"use client";

import styles from "./booking.module.css";

interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
}

const TIMEZONES: { region: string; zones: string[] }[] = [
  {
    region: "americas",
    zones: [
      "America/Los_Angeles",
      "America/Denver",
      "America/Phoenix",
      "America/Chicago",
      "America/New_York",
      "America/Toronto",
      "America/Mexico_City",
      "America/Sao_Paulo",
      "America/Buenos_Aires",
      "America/Bogota",
      "America/Santiago",
      "America/Halifax",
      "America/Anchorage",
      "Pacific/Honolulu",
    ],
  },
  {
    region: "europe & africa",
    zones: [
      "Europe/London",
      "Europe/Dublin",
      "Europe/Lisbon",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Madrid",
      "Europe/Rome",
      "Europe/Amsterdam",
      "Europe/Stockholm",
      "Europe/Athens",
      "Europe/Istanbul",
      "Europe/Moscow",
      "Africa/Cairo",
      "Africa/Lagos",
      "Africa/Johannesburg",
    ],
  },
  {
    region: "asia & pacific",
    zones: [
      "Asia/Dubai",
      "Asia/Karachi",
      "Asia/Kolkata",
      "Asia/Bangkok",
      "Asia/Singapore",
      "Asia/Hong_Kong",
      "Asia/Shanghai",
      "Asia/Tokyo",
      "Asia/Seoul",
      "Australia/Sydney",
      "Australia/Perth",
      "Pacific/Auckland",
    ],
  },
];

export function TimezoneSelect({ value, onChange }: TimezoneSelectProps) {
  // Ensure the current value appears in the list even if not in the curated set.
  const allZones = new Set(TIMEZONES.flatMap((g) => g.zones));
  const showExtra = !allZones.has(value);

  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="timezone"
    >
      {showExtra && <option value={value}>{value}</option>}
      {TIMEZONES.map((group) => (
        <optgroup label={group.region} key={group.region}>
          {group.zones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
