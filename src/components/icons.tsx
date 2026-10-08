type IconName =
  | "calendar"
  | "ticket"
  | "users"
  | "qr"
  | "scan"
  | "check"
  | "checkCircle"
  | "alert"
  | "xCircle"
  | "x"
  | "grid"
  | "logout"
  | "plus"
  | "edit"
  | "trash"
  | "search"
  | "pin"
  | "clock"
  | "mail"
  | "shield"
  | "user"
  | "camera"
  | "download"
  | "copy"
  | "list"
  | "chart"
  | "bolt"
  | "chevronRight"
  | "arrowLeft"
  | "lock"
  | "info"
  | "keyboard";

const PATHS: Record<IconName, string[]> = {
  calendar: [
    "M7 3v3",
    "M17 3v3",
    "M3.5 8.5h17",
    "M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Z",
  ],
  ticket: [
    "M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v1.7a1.9 1.9 0 0 0 0 3.6v1.7A1.5 1.5 0 0 1 18.5 17h-13A1.5 1.5 0 0 1 4 15.5v-1.7a1.9 1.9 0 0 0 0-3.6Z",
    "M14 7v10",
  ],
  users: [
    "M8.5 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z",
    "M2.75 19.5c0-3.1 2.6-5.25 5.75-5.25s5.75 2.15 5.75 5.25",
    "M16.5 5.2a3.2 3.2 0 0 1 0 6.2",
    "M17.6 14.6c2.2.5 3.65 2.2 3.65 4.9",
  ],
  qr: [
    "M4 4h5v5H4z",
    "M15 4h5v5h-5z",
    "M4 15h5v5H4z",
    "M15 15h2v2h-2z",
    "M19 19h1v1h-1z",
    "M15 19h2v1h-2z",
    "M19 15h1v2h-1z",
  ],
  scan: [
    "M4 8.5V6a2 2 0 0 1 2-2h2.5",
    "M15.5 4H18a2 2 0 0 1 2 2v2.5",
    "M20 15.5V18a2 2 0 0 1-2 2h-2.5",
    "M8.5 20H6a2 2 0 0 1-2-2v-2.5",
    "M4 12h16",
  ],
  check: ["M4.5 12.5 9.5 17.5 19.5 6.5"],
  checkCircle: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 12.2l2.7 2.7L16.2 9.4"],
  alert: ["M12 3.7 21 19.3H3z", "M12 9.5v4.2", "M12 16.8h.01"],
  xCircle: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9.2 9.2l5.6 5.6", "M14.8 9.2l-5.6 5.6"],
  x: ["M6 6l12 12", "M18 6 6 18"],
  grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  logout: [
    "M15 5.5V4a1.5 1.5 0 0 0-1.5-1.5h-8A1.5 1.5 0 0 0 4 4v16a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 15 19.5V18",
    "M9.5 12H21",
    "M18 8.8 21.2 12 18 15.2",
  ],
  plus: ["M12 5v14", "M5 12h14"],
  edit: ["M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17v3Z", "M14.5 6.5l3 3"],
  trash: [
    "M4.5 7h15",
    "M9.5 7V4.8h5V7",
    "M6.5 7l.9 12.2a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7",
    "M10.5 11v6",
    "M13.5 11v6",
  ],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "M16.2 16.2 21 21"],
  pin: [
    "M12 21s6.5-5.6 6.5-10.4A6.5 6.5 0 0 0 5.5 10.6C5.5 15.4 12 21 12 21Z",
    "M12 12.8a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z",
  ],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7.5V12l3.2 2"],
  mail: ["M3.5 6.5h17v11h-17z", "M3.8 7l8.2 6 8.2-6"],
  shield: [
    "M12 3.2 20 6v6c0 4.6-3.3 7.7-8 8.8-4.7-1.1-8-4.2-8-8.8V6Z",
    "M9 12.2l2.2 2.2L15.2 10.4",
  ],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4.8 20.2c.7-3.6 3.6-5.7 7.2-5.7s6.5 2.1 7.2 5.7"],
  camera: ["M4 8.5h3l1.4-2h7.2L17 8.5h3v10H4z", "M12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  download: ["M12 4v10", "M8.2 10.6 12 14.4l3.8-3.8", "M5 18.5h14"],
  copy: ["M9 9h10v10H9z", "M15 9V5H5v10h4"],
  list: ["M8 6.5h12", "M8 12h12", "M8 17.5h12", "M4 6.5h.01", "M4 12h.01", "M4 17.5h.01"],
  chart: ["M5 19.5V13", "M12 19.5V5", "M19 19.5v-8"],
  bolt: ["M13 3 5.5 13.5H11L10 21l7.5-10.5H12Z"],
  chevronRight: ["M9.5 5.5 16 12l-6.5 6.5"],
  arrowLeft: ["M19 12H5", "M10.5 6.5 5 12l5.5 5.5"],
  lock: ["M6.5 10.5h11v9h-11z", "M9 10.5V7.8a3 3 0 0 1 6 0v2.7"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 11v5.5", "M12 7.8h.01"],
  keyboard: ["M3 6.5h18v11H3z", "M7 10h.01", "M10.5 10h.01", "M14 10h.01", "M17.5 10h.01", "M8 14h8"],
};

export type { IconName };

export function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}
