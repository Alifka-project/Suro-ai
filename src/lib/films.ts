/**
 * The films in the section under the hero (FilmTour). They play one at a
 * time, in this order. With two or more, the section holds still while the
 * visitor scrolls through them, then the page moves on.
 *
 * To add a film, put its files in public/media/films/ and add an entry:
 *   name.mp4      H.264, 1920×1080 (16:9). HiDPI tablets and desktops (above
 *                 1.25 dppx, such as Retina screens) play this one.
 *   name-720.mp4  The same film at 1280×720, for phones and standard-density
 *                 screens (1.25 dppx or less). Optional, but it saves those
 *                 visitors about two thirds of the download.
 *   name.webp     A still for before it plays, 1600×900.
 * Keep each film short (3–15 s): it starts as the visitor reaches it.
 */
export type Film = {
  /** Stable key. */
  id: string;
  /** Short title, shown in the film list. */
  title: string;
  /** One sentence under the title. Shown on the page, so keep it plain. */
  caption: string;
  /** The 1080p MP4. */
  src: string;
  /** A 720p copy for phones and standard-density screens, if there is one. */
  srcSmall?: string;
  /** Still shown before the film plays. */
  poster: string;
  /** The film has a soundtrack, so it gets a sound toggle. Films always start muted. */
  sound?: boolean;
};

/** Short films of the delivery control tower, cut from one 10-second film. */
export const FILMS: readonly Film[] = [
  {
    id: "control-tower-orders",
    title: "Every order, in view.",
    caption: "Every shipment, its status and the day's numbers on one screen.",
    src: "/media/films/control-tower-1.mp4",
    srcSmall: "/media/films/control-tower-1-720.mp4",
    poster: "/media/films/control-tower-1.webp",
    sound: true,
  },
  {
    id: "control-tower-drivers",
    title: "Every driver, live on the map.",
    caption: "Each delivery tracked live, from dispatch to proof of delivery.",
    src: "/media/films/control-tower-2.mp4",
    srcSmall: "/media/films/control-tower-2-720.mp4",
    poster: "/media/films/control-tower-2.webp",
    sound: true,
  },
  {
    id: "control-tower-overview",
    title: "One control tower.",
    caption: "Orders, drivers and deliveries in one place, for the whole team.",
    src: "/media/films/control-tower-3.mp4",
    srcSmall: "/media/films/control-tower-3-720.mp4",
    poster: "/media/films/control-tower-3.webp",
    sound: true,
  },
];
