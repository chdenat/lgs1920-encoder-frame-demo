# Encoder frame streaming demo

This is a standalone Eleventy application named **Video Encoder Demo** for demonstrating frame-by-frame upload to the local LGS1920 encoder API.

The demo captures the local source video one frame at a time, sends each RGBA frame to the encoder through the `/encoder` server proxy, waits for the encoded result, and plays the reconstructed target at the source frame rate. The control panel can pace requests in real time or run them as fast as the API accepts them.

## Run

Start the encoder API first from the encoder project:

```bash
cd ../encoder
ENCODER_OPEN_DASHBOARD=false bun run start
```

Then start this independent demo application:

```bash
cd ../encoder-frame-demo
bun install
bun run start
```

The server opens `http://127.0.0.1:47833` in a browser. Set `DEMO_OPEN_BROWSER=false` to disable that behavior. The encoder endpoint defaults to `http://127.0.0.1:47832`; override it with `ENCODER_ORIGIN` when needed.

The app owns its Eleventy build, browser server, static video asset, Web Awesome bundle, and API proxy. It does not depend on the encoder dashboard UI.

The page also includes an inline **moonlit unicorn** frame demo. Select PNG or JPEG and a cadence up to 60 fps, click **Generate frames**, and the complete twenty-second cartoon story is created in memory before any encoder job starts. Review it with **View frames**, then click **Encode prepared frames**; the page decodes the prepared images to RGBA, lists each health, session, job, frame, completion, event, and output request, and plays the resulting MP4 when the job completes. At high frame rates the gallery keeps a representative sample of up to 60 frames.

Start LGS1920 Encoder first. The demo checks `http://127.0.0.1:47832/health` before it opens and before every capture. Choose the Contemplation or VTT hero video in the **Source video** setting inside **Encoding to MP4**. The reconstructed target video is played inside this demo window; the encoder dashboard is never opened by the demo. Both sources use their complete local duration and start at 30 fps by default. The selector supports 2, 5, 10, 15, 30, and 60 fps.

## Source video

The bundled ten-second clip is taken from the Wikimedia Commons copy of *Steamboat Willie* (1928), with rights and regional restrictions described on the source page:

https://commons.wikimedia.org/wiki/File:Steamboat_Willie_(1928)_by_Walt_Disney.webm
