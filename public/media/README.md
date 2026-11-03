# Media

## films/

The short films in the section under the hero (`#films`). They play one at a
time, in the order listed in `src/lib/films.ts`. While the visitor scrolls,
the section holds still and moves from one film to the next, then the page
carries on.

Each film has three files:

| File | What it is |
| --- | --- |
| `name.mp4` | The film. H.264, 1920×1080 (16:9), with `-movflags +faststart` so it starts before it has fully downloaded. HiDPI tablets and desktops (above 1.25 dppx, such as Retina screens) play this one. |
| `name-720.mp4` | The same film at 1280×720, for phones and standard-density screens (1.25 dppx or less, such as Windows at 100% or 125%). Optional, but it saves those visitors about two thirds of the download. |
| `name.webp` | A still shown before the film plays, and to visitors who turn motion off. 1600×900. |

Keep each film short (3–15 seconds) and under about 3 MB: a film starts the
moment the visitor reaches it, and they scroll on when they've seen it. Films
start muted; a film with a soundtrack gets a sound button.

### To add or swap a film

1. Put its three files in this folder.
2. Add an entry to `FILMS` in `src/lib/films.ts`: a title, a one-line
   caption and the three paths. The order of the list is the playing order.
3. Redeploy. The section grows by one step per film. With one film it no
   longer holds the page; with none, it disappears.

One way to make the files with ffmpeg, from a 1080p master:

```bash
ffmpeg -i master.mp4 -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart name.mp4
ffmpeg -i master.mp4 -vf scale=1280:-2 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart name-720.mp4
ffmpeg -ss 2 -i master.mp4 -frames:v 1 -vf scale=1600:-2 -c:v libwebp -quality 82 name.webp
```
