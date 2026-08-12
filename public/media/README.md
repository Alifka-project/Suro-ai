# Media

## intro.mp4
Drop your 60–90 second intro film here as `intro.mp4`.
The player in the "Who we are" section picks it up automatically —
no code change needed. Until the file exists, the frame shows an
on-brand placeholder instead of a broken player.

Recommended: H.264 MP4, 1920×1080, under ~15 MB.
For anything larger, host it (Mux, Cloudflare Stream, YouTube) and
swap `VIDEO_SRC` in `src/components/sections/IntroVideo.tsx`.

## intro-poster.jpg
Optional still frame shown before playback. Same aspect ratio as the
video (16:9). If absent, a brand gradient is used instead.
