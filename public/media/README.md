# Media

## intro.mp4
Drop your 60–90 second intro film here as `intro.mp4`.
The player in the About section (`#about`) picks it up automatically, with
no code change. Until the file exists, the frame shows an on-brand
placeholder instead of a broken player. Redeploy after adding it.

Recommended: H.264 MP4, 1920×1080, under ~15 MB.
For anything larger, host it (Mux, Cloudflare Stream, YouTube) and
swap `VIDEO_SRC` in `src/components/sections/About.tsx`.

## intro-poster.jpg
Optional still frame shown before playback. Same aspect ratio as the
video (16:9). If absent, a brand gradient is used instead.
