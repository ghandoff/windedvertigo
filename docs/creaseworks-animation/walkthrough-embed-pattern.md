# walkthrough video — embed pattern

> for when the video is ready to place on a creaseworks page or draft route.
> follows wcag 2.2.2: no autoplay, pause control present, poster image required.

## direct link (share for review)

https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev/animation-sprint/walkthrough-tissue-paper-flowers.mp4

## embed snippet

paste this into any creaseworks page or component. swap `poster` for a real still frame once the final video is ready.

```html
<figure class="walkthrough-video">
  <video
    src="https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev/animation-sprint/walkthrough-tissue-paper-flowers.mp4"
    poster="/harbour/creaseworks/video-posters/walkthrough-placeholder.jpg"
    controls
    preload="metadata"
    width="1920"
    height="1080"
    style="width: 100%; height: auto; border-radius: 12px;"
    aria-label="tissue paper flowers — playdate walkthrough"
  >
    your browser does not support video playback.
  </video>
  <figcaption>tissue paper flowers</figcaption>
</figure>
```

**no autoplay** — wcag 2.2.2 requires a pause/stop control for anything that plays automatically and lasts more than 5 seconds. `controls` provides this; `autoplay` is intentionally absent.

**preload="metadata"** — loads duration and first frame only; does not download the full file on page load.

## cost notes (r2)

- storage: $0.015 / GB / month. at 761 KB this is effectively $0.00/mo.
- egress: r2 has no egress fee for public bucket reads.
- per-video render time: ~30 s on m-series mac. cost: your time only — no cloud compute involved.
- if parameterised (one render per playdate): at 30 s/video, 100 playdates ≈ 50 min of local rendering. trivial.
