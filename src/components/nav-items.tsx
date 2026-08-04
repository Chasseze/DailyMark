import type { ReactNode } from "react";

/**
 * The four primary destinations, shared by the mobile tab bar and the desktop
 * rail so the two can never drift apart.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const;

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/notes",
    label: "Notes",
    icon: (
      <svg {...iconProps}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7.5L19 8.25v12a.75.75 0 0 1-.75.75H7.75A.75.75 0 0 1 7 20.25V3.75Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 3.75V8H19M9.5 12h5M9.5 15.5h5" />
      </svg>
    ),
  },
  {
    to: "/thoughts",
    label: "Thoughts",
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.5 4.75h5a2 2 0 0 1 2 2v3.5a4.5 4.5 0 0 1-2.2 3.9L14 18.5l-2-.9-2 .9-.3-4.35A4.5 4.5 0 0 1 7.5 10.25v-3.5a2 2 0 0 1 2-2Z"
        />
        <path strokeLinecap="round" d="M10 8.5h4M10.5 11h3" />
      </svg>
    ),
  },
  {
    to: "/rhythm",
    label: "Rhythm",
    icon: (
      <svg {...iconProps}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 14.5h3l2.5-7 3 11 2.5-8 1.75 4h4.25" />
      </svg>
    ),
  },
  {
    to: "/daily",
    label: "Daily",
    icon: (
      <svg {...iconProps}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5v2M12 18.5v2M4.5 12h-2M21.5 12h-2M6.2 6.2 4.8 4.8M19.2 19.2l-1.4-1.4M6.2 17.8 4.8 19.2M19.2 4.8l-1.4 1.4" />
        <circle cx="12" cy="12" r="4.25" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.52.95.84 1.51.84H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];
