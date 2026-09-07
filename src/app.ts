import '@awesome.me/webawesome/dist/styles/webawesome.css'
import '@awesome.me/webawesome/dist/components/badge/badge.js'
import '@awesome.me/webawesome/dist/components/button/button.js'
import '@awesome.me/webawesome/dist/components/card/card.js'
import '@awesome.me/webawesome/dist/components/divider/divider.js'
import '@awesome.me/webawesome/dist/components/dialog/dialog.js'
import '@awesome.me/webawesome/dist/components/details/details.js'
import '@awesome.me/webawesome/dist/components/icon/icon.js'
import '@awesome.me/webawesome/dist/components/input/input.js'
import '@awesome.me/webawesome/dist/components/option/option.js'
import '@awesome.me/webawesome/dist/components/page/page.js'
import '@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js'
import '@awesome.me/webawesome/dist/components/select/select.js'
import './brand/wa-theme-lgs1920-base.css'
import './styles.css'

type DemoJob = {
    id: string
    phase: string
    progress: number
    frameCount?: number
    receivedFrames?: number
    outputUrl?: string
    error?: string
}

type FrameApiJob = {
    id: string
    status: 'queued' | 'encoding' | 'completed' | 'failed' | 'canceled'
    progress: number
    error?: string
}

type FrameApiCall = {
    badge: HTMLElement
    detail: HTMLElement
    startedAt: number
}

type ControlElement = HTMLElement & {value?: string}

const elements = {
    encoderStatus: document.querySelector('#encoder-status'),
    demoKicker: document.querySelector('#demo-kicker'),
    demoDescription: document.querySelector('#demo-description'),
    sourceVideo: document.querySelector('#source-video') as HTMLVideoElement | null,
    sourceMedia: document.querySelector('#source-media') as HTMLSourceElement | null,
    sourceCredit: document.querySelector('#source-credit'),
    targetVideo: document.querySelector('#target-video') as HTMLVideoElement | null,
    targetStage: document.querySelector('.target-stage') as HTMLElement | null,
    targetPlaceholder: document.querySelector('#target-placeholder') as HTMLElement | null,
    videoSourceInput: document.querySelector('#video-source-input') as ControlElement | null,
    durationInput: document.querySelector('#duration-input') as ControlElement | null,
    frameRateInput: document.querySelector('#frame-rate-input') as ControlElement | null,
    frameWidthInput: document.querySelector('#frame-width-input') as ControlElement | null,
    frameHeightInput: document.querySelector('#frame-height-input') as ControlElement | null,
    outputWidthInput: document.querySelector('#output-width-input') as ControlElement | null,
    outputHeightInput: document.querySelector('#output-height-input') as ControlElement | null,
    qualityInput: document.querySelector('#quality-input') as ControlElement | null,
    accelerationInput: document.querySelector('#acceleration-input') as ControlElement | null,
    pacingInput: document.querySelector('#pacing-input') as ControlElement | null,
    startButton: document.querySelector('#start-button') as HTMLElement | null,
    stopButton: document.querySelector('#stop-button') as HTMLElement | null,
    setupMessage: document.querySelector('#setup-message'),
    sourceFrameLabel: document.querySelector('#source-frame-label'),
    sourceTime: document.querySelector('#source-time'),
    requestRoute: document.querySelector('#request-route'),
    requestFramePreview: document.querySelector('#request-frame-preview') as HTMLCanvasElement | null,
    frameCounter: document.querySelector('#frame-counter'),
    phaseLabel: document.querySelector('#phase-label'),
    progressLabel: document.querySelector('#progress-label'),
    responseLabel: document.querySelector('#response-label'),
    progress: document.querySelector('#demo-progress') as ControlElement | null,
    requestLog: document.querySelector('#request-log'),
    targetTime: document.querySelector('#target-time'),
    targetStatus: document.querySelector('#target-status'),
    runFrameApiButton: document.querySelector('#run-frame-api-button') as HTMLElement | null,
    encodeFrameApiButton: document.querySelector('#encode-frame-api-button') as HTMLElement | null,
    stopFrameApiButton: document.querySelector('#stop-frame-api-button') as HTMLElement | null,
    frameApiFormat: document.querySelector('#frame-api-format') as ControlElement | null,
    frameApiRate: document.querySelector('#frame-api-rate') as ControlElement | null,
    frameApiStatus: document.querySelector('#frame-api-status'),
    frameApiJobId: document.querySelector('#frame-api-job-id'),
    frameApiProgress: document.querySelector('#frame-api-progress') as ControlElement | null,
    frameApiMessage: document.querySelector('#frame-api-message'),
    frameApiCalls: document.querySelector('#frame-api-calls'),
    frameApiPreview: document.querySelector('#frame-api-preview') as HTMLCanvasElement | null,
    frameApiOutputVideo: document.querySelector('#frame-api-output-video') as HTMLVideoElement | null,
    frameGalleryButton: document.querySelector('#frame-gallery-button') as HTMLElement | null,
    frameGalleryLabel: document.querySelector('#frame-gallery-label'),
    frameGalleryDialog: document.querySelector('#frame-gallery-dialog') as (HTMLElement & {open?: boolean}) | null,
    frameGallery: document.querySelector('#frame-gallery'),
}

const state: {
    token: string
    job?: DemoJob
    abortController?: AbortController
    targetUrl?: string
    logLines: string[]
    frameApiAbortController?: AbortController
    frameApiOutputUrl?: string
    frameGalleryUrls: string[]
    preparedFrameImages: Blob[]
    preparedFrameRate?: number
    preparedFrameFormat?: 'png' | 'jpeg'
} = {
    token: '',
    logLines: [],
    frameGalleryUrls: [],
    preparedFrameImages: [],
}

const UNICORN_DURATION_SECONDS = 20

/** Read a Web Awesome control value. */
const controlValue = (element: ControlElement | null, fallback: string): string => element?.value ?? fallback

/** Read a positive numeric Web Awesome control value. */
const controlNumber = (element: ControlElement | null, fallback: number): number => {
    const value = Number(controlValue(element, String(fallback)))
    return Number.isFinite(value) && value > 0 ? value : fallback
}

/** Return whether the optional VTT hero FPS demo is active. */
const isVttDemo = (): boolean => new URLSearchParams(window.location.search).get('demo') === 'vtt'

/** Configure the source and defaults for the optional VTT hero FPS demo. */
const configureDemoMode = (): void => {
    if (!isVttDemo()) {
        if (elements.videoSourceInput) {
            elements.videoSourceInput.value = 'contemplation'
        }
        return
    }

    elements.demoKicker!.textContent = 'VTT HERO · FPS DEMO'
    elements.demoDescription!.textContent = 'Capture the VTT hero video at different frame rates, send every frame to the local encoder, and compare the reconstructed output at real speed.'
    elements.videoSourceInput!.value = 'vtt'
    elements.sourceCredit!.textContent = 'VTT hero · Pexels 11212807 · durée complète'
    elements.sourceMedia!.src = 'assets/vtt-demo.mp4'
    elements.sourceMedia!.type = 'video/mp4'
    elements.frameRateInput!.value = '30'
    elements.frameHeightInput!.value = '360'
    elements.sourceVideo?.load()
}

/** Set the dashboard status message. */
const setMessage = (message: string, isError = false): void => {
    if (!elements.setupMessage) {
        return
    }

    elements.setupMessage.textContent = message
    elements.setupMessage.toggleAttribute('data-error', isError)
}

/** Check that the separately launched encoder application is ready. */
const checkEncoderHealth = async (): Promise<boolean> => {
    try {
        const response = await fetch('/encoder/health', {cache: 'no-store'})
        if (!response.ok) {
            throw new Error(`Health check returned ${response.status}`)
        }

        elements.encoderStatus!.textContent = 'Encoder: ready'
        elements.encoderStatus!.setAttribute('variant', 'success')
        elements.startButton?.removeAttribute('disabled')
        elements.runFrameApiButton?.removeAttribute('disabled')
        if (state.preparedFrameImages.length > 0 && !state.frameApiAbortController) {
            elements.encodeFrameApiButton?.removeAttribute('disabled')
        }
        return true
    }
    catch {
        elements.encoderStatus!.textContent = 'Encoder: not running'
        elements.encoderStatus!.setAttribute('variant', 'danger')
        elements.startButton?.setAttribute('disabled', '')
        elements.runFrameApiButton?.setAttribute('disabled', '')
        elements.encodeFrameApiButton?.setAttribute('disabled', '')
        return false
    }
}

/** Append one line to the central request card log. */
const log = (message: string): void => {
    state.logLines = [...state.logLines.slice(-30), message]
    if (elements.requestLog) {
        elements.requestLog.textContent = state.logLines.join('\n')
        elements.requestLog.scrollTop = elements.requestLog.scrollHeight
    }
}

/** Update the visible frame pipeline counters. */
const updatePipeline = (job: DemoJob | undefined, responseStatus?: number): void => {
    const progress = Math.round((job?.progress ?? 0) * 100)
    if (elements.frameCounter) {
        elements.frameCounter.textContent = `${job?.receivedFrames ?? 0} / ${job?.frameCount ?? 0}`
    }
    if (elements.phaseLabel) {
        elements.phaseLabel.textContent = job?.phase ?? 'Idle'
    }
    if (elements.progressLabel) {
        elements.progressLabel.textContent = `${progress}%`
    }
    if (elements.responseLabel && responseStatus !== undefined) {
        elements.responseLabel.textContent = String(responseStatus)
    }
    if (elements.progress) {
        elements.progress.value = String(progress)
        elements.progress.setAttribute('label', `Frame pipeline progress ${progress}%`)
    }
}

/** Fetch JSON through the standalone demo's encoder proxy. */
const apiJson = async <T>(path: string, init: RequestInit = {}): Promise<{data: T; status: number}> => {
    const headers = new Headers(init.headers)
    if (state.token) {
        headers.set('Authorization', `Bearer ${state.token}`)
    }

    const response = await fetch(`/encoder${path}`, {
        ...init,
        headers,
        cache: init.cache ?? 'no-store',
        signal: state.abortController?.signal,
    })
    const data = await response.json() as T & {error?: {message?: string}}
    if (!response.ok) {
        throw new Error(data.error?.message ?? `Encoder request failed with status ${response.status}`)
    }

    return {data, status: response.status}
}

/** Add one visible request to the standalone Frame API test. */
const startFrameApiCall = (method: string, path: string): FrameApiCall | undefined => {
    if (!elements.frameApiCalls) {
        return undefined
    }

    const row = document.createElement('div')
    row.className = 'api-call wa-cluster wa-gap-xs wa-align-items-center'
    const badge = document.createElement('wa-badge')
    badge.setAttribute('variant', 'warning')
    badge.textContent = 'pending'
    const request = document.createElement('code')
    request.className = 'api-call-request'
    request.textContent = `${method} /encoder${path}`
    const detail = document.createElement('span')
    detail.className = 'field-message api-call-detail'
    detail.textContent = 'waiting'
    row.append(badge, request, detail)
    elements.frameApiCalls.prepend(row)

    return {badge, detail, startedAt: performance.now()}
}

/** Finish one visible Frame API request with its result and elapsed time. */
const finishFrameApiCall = (call: FrameApiCall | undefined, status: number, error?: string): void => {
    if (!call) {
        return
    }

    const elapsed = Math.round(performance.now() - call.startedAt)
    const ok = !error && status >= 200 && status < 300
    call.badge.setAttribute('variant', ok ? 'success' : 'danger')
    call.badge.textContent = ok ? 'done' : 'error'
    call.detail.textContent = error ?? `${status} · ${elapsed} ms`
}

/** Call the encoder proxy while keeping every Frame API request visible. */
const frameApiJson = async <T>(method: string, path: string, init: RequestInit = {}): Promise<T> => {
    const call = startFrameApiCall(method, path)
    const headers = new Headers(init.headers)
    if (state.token) {
        headers.set('Authorization', `Bearer ${state.token}`)
    }

    try {
        const response = await fetch(`/encoder${path}`, {
            ...init,
            headers,
            cache: 'no-store',
            signal: state.frameApiAbortController?.signal,
        })
        const body = await response.json() as T & {error?: {message?: string}}
        if (!response.ok) {
            const message = body.error?.message ?? `Request failed with status ${response.status}`
            finishFrameApiCall(call, response.status, message)
            throw new Error(message)
        }

        finishFrameApiCall(call, response.status)
        return body
    }
    catch (error) {
        if (error instanceof Error && call?.badge.textContent === 'pending') {
            finishFrameApiCall(call, 0, error.message)
        }
        throw error
    }
}

/** Show one frame job state in the unicorn frame demo. */
const renderFrameApiJob = (job: FrameApiJob): void => {
    const progress = Math.round(job.progress * 100)
    elements.frameApiStatus?.setAttribute('variant', job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'brand')
    if (elements.frameApiStatus) {
        elements.frameApiStatus.textContent = job.status
    }
    if (elements.frameApiJobId) {
        elements.frameApiJobId.textContent = `Job ${job.id}`
    }
    if (elements.frameApiProgress) {
        elements.frameApiProgress.value = String(progress)
        elements.frameApiProgress.setAttribute('label', `Frame API progress ${progress}%`)
        elements.frameApiProgress.textContent = `${progress}%`
    }
    if (elements.frameApiMessage) {
        elements.frameApiMessage.textContent = job.status === 'failed'
            ? job.error ?? 'The Frame API test failed.'
            : job.status === 'completed'
                ? 'The twenty-second unicorn video is ready.'
                : `The frame job is ${job.status}.`
    }
}

/** Reset the unicorn frame demo before a new run. */
const resetFrameApi = (): void => {
    elements.frameApiStatus?.setAttribute('variant', 'neutral')
    if (elements.frameApiStatus) {
        elements.frameApiStatus.textContent = 'Ready'
    }
    if (elements.frameApiJobId) {
        elements.frameApiJobId.textContent = 'No frame job yet'
    }
    if (elements.frameApiProgress) {
        elements.frameApiProgress.value = '0'
        elements.frameApiProgress.setAttribute('label', 'Frame API progress')
        elements.frameApiProgress.textContent = '0%'
    }
    if (elements.frameApiMessage) {
        elements.frameApiMessage.textContent = 'The unicorn story is ready.'
    }
    elements.frameApiCalls?.replaceChildren()
    state.preparedFrameImages = []
    state.preparedFrameRate = undefined
    state.preparedFrameFormat = undefined
    elements.encodeFrameApiButton?.setAttribute('disabled', '')
    for (const url of state.frameGalleryUrls) {
        URL.revokeObjectURL(url)
    }
    state.frameGalleryUrls = []
    if (elements.frameGallery) {
        const emptyState = document.createElement('p')
        emptyState.className = 'frame-gallery-empty'
        emptyState.textContent = 'No generated frames yet. Start the unicorn frame demo to populate the viewer.'
        elements.frameGallery.replaceChildren(emptyState)
    }
    if (elements.frameGalleryLabel) {
        elements.frameGalleryLabel.textContent = 'View frames'
    }
    if (elements.frameApiOutputVideo) {
        elements.frameApiOutputVideo.pause()
        elements.frameApiOutputVideo.removeAttribute('src')
        elements.frameApiOutputVideo.hidden = true
    }
    if (state.frameApiOutputUrl) {
        URL.revokeObjectURL(state.frameApiOutputUrl)
        state.frameApiOutputUrl = undefined
    }
}

/** Poll a frame job until it reaches a terminal state. */
const waitForFrameApiCompletion = async (initialJob: FrameApiJob): Promise<FrameApiJob> => {
    let currentJob = initialJob
    for (let attempt = 0; attempt < 1200; attempt += 1) {
        if (['completed', 'failed', 'canceled'].includes(currentJob.status)) {
            return currentJob
        }

        await wait(250)
        currentJob = await frameApiJson<FrameApiJob>('GET', `/v1/jobs/${initialJob.id}`)
        renderFrameApiJob(currentJob)
    }

    throw new Error('The unicorn frame demo did not finish within five minutes')
}

/** Keep the job event stream visible while the frames are uploaded. */
const observeFrameApiEvents = async (jobId: string): Promise<void> => {
    const path = `/v1/jobs/${jobId}/events`
    const call = startFrameApiCall('GET', path)
    const headers = state.token ? {Authorization: `Bearer ${state.token}`} : undefined

    try {
        const response = await fetch(`/encoder${path}`, {headers, signal: state.frameApiAbortController?.signal})
        if (!response.ok || !response.body) {
            throw new Error(`Event stream failed with status ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let done = false
        while (!done) {
            const result = await reader.read()
            done = result.done
            buffer += decoder.decode(result.value ?? new Uint8Array(), {stream: !done})
            const events = buffer.split('\n\n')
            buffer = events.pop() ?? ''
            for (const event of events) {
                const dataLine = event.split('\n').find(line => line.startsWith('data: '))
                if (dataLine) {
                    renderFrameApiJob(JSON.parse(dataLine.slice(6)) as FrameApiJob)
                }
            }
        }
        finishFrameApiCall(call, response.status)
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Event stream failed'
        finishFrameApiCall(call, 0, message)
        throw error
    }
}

/** Draw one frame of the twenty-second animated unicorn story. */
const createFrameApiImage = async (index: number, format: 'png' | 'jpeg', frameCount: number, frameRate: number): Promise<Blob> => {
    const width = 320
    const height = 180
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
        throw new Error('The browser could not create a 2D canvas')
    }

    const progress = frameCount > 1 ? index / (frameCount - 1) : 0
    const seconds = index / frameRate
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, `hsl(${Math.round(224 - progress * 18)} 58% ${Math.round(24 + progress * 8)}%)`)
    gradient.addColorStop(1, `hsl(${Math.round(274 - progress * 22)} 64% ${Math.round(38 + progress * 10)}%)`)
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    // Stars and moon establish the recurring night sky.
    context.fillStyle = 'rgba(255, 255, 255, 0.8)'
    for (let star = 0; star < 18; star += 1) {
        const x = 12 + ((star * 47) % 296)
        const y = 16 + ((star * 29) % 70)
        const radius = 0.6 + ((star + index) % 3) * 0.4
        context.globalAlpha = 0.35 + ((star + index) % 5) * 0.12
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
    }
    context.globalAlpha = 1
    context.fillStyle = '#fff1b8'
    context.beginPath()
    context.arc(264, 38, 18, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = 'rgba(180, 157, 215, 0.28)'
    context.beginPath()
    context.arc(271, 32, 17, 0, Math.PI * 2)
    context.fill()

    // Meadow, distant hills, a rainbow and the destination castle.
    context.fillStyle = '#172d4a'
    context.beginPath()
    context.moveTo(0, 128)
    context.quadraticCurveTo(72, 92, 142, 128)
    context.quadraticCurveTo(228, 90, 320, 126)
    context.lineTo(320, 180)
    context.lineTo(0, 180)
    context.fill()
    context.fillStyle = '#1b583f'
    context.fillRect(0, 143, width, 37)
    if (progress > 0.28) {
        context.strokeStyle = 'rgba(255, 126, 210, 0.55)'
        context.lineWidth = 5
        context.beginPath()
        context.arc(174, 153, 82, Math.PI * 1.12, Math.PI * 1.88)
        context.stroke()
        context.strokeStyle = 'rgba(255, 220, 105, 0.55)'
        context.lineWidth = 4
        context.beginPath()
        context.arc(174, 153, 72, Math.PI * 1.12, Math.PI * 1.88)
        context.stroke()
        context.strokeStyle = 'rgba(121, 217, 255, 0.55)'
        context.beginPath()
        context.arc(174, 153, 62, Math.PI * 1.12, Math.PI * 1.88)
        context.stroke()
    }
    context.fillStyle = '#d9b6ff'
    context.fillRect(274, 105, 28, 39)
    context.fillStyle = '#f2d7ff'
    context.beginPath()
    context.moveTo(270, 105)
    context.lineTo(288, 86)
    context.lineTo(306, 105)
    context.fill()
    context.fillStyle = '#ffd66e'
    context.fillRect(282, 118, 6, 9)
    context.fillRect(294, 118, 6, 9)

    // The unicorn follows a believable horse silhouette as the story progresses.
    const unicornX = 42 + progress * 202
    const gait = Math.sin(seconds * Math.PI * 2)
    const unicornY = 127 - Math.abs(gait) * 2
    const coat = '#f4eef8'
    const coatShadow = '#b9a7c9'
    const outline = '#684d79'

    // Ground shadow gives the character weight instead of making it float.
    context.fillStyle = 'rgba(7, 18, 27, 0.42)'
    context.beginPath()
    context.ellipse(unicornX, unicornY + 31, 39, 4, 0, 0, Math.PI * 2)
    context.fill()

    const drawLeg = (legX: number, phase: number, behind: boolean): void => {
        const lift = Math.max(0, Math.sin(seconds * Math.PI * 2 + phase)) * 3
        context.strokeStyle = behind ? '#8e789f' : coatShadow
        context.lineWidth = 7
        context.lineCap = 'round'
        context.beginPath()
        context.moveTo(legX, unicornY + 6)
        context.quadraticCurveTo(legX - 1, unicornY + 16, legX + lift, unicornY + 25)
        context.lineTo(legX - 1 + lift, unicornY + 33)
        context.stroke()
        context.strokeStyle = behind ? '#c3adcf' : '#fffaff'
        context.lineWidth = 3
        context.beginPath()
        context.moveTo(legX - 1, unicornY + 7)
        context.quadraticCurveTo(legX - 1, unicornY + 17, legX + lift, unicornY + 25)
        context.lineTo(legX - 1 + lift, unicornY + 32)
        context.stroke()
        context.fillStyle = outline
        context.beginPath()
        context.ellipse(legX - 1 + lift, unicornY + 34, 4, 2, 0, 0, Math.PI * 2)
        context.fill()
    }

    // Rear legs and tail are drawn behind the body.
    drawLeg(unicornX - 18, Math.PI, true)
    drawLeg(unicornX + 8, 0, true)
    context.strokeStyle = '#b875c9'
    context.lineWidth = 8
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(unicornX - 25, unicornY - 2)
    context.bezierCurveTo(unicornX - 48, unicornY - 13, unicornX - 50, unicornY + 14, unicornX - 38, unicornY + 19)
    context.bezierCurveTo(unicornX - 48, unicornY + 2, unicornX - 37, unicornY - 8, unicornX - 25, unicornY - 2)
    context.stroke()
    context.strokeStyle = '#f2b7eb'
    context.lineWidth = 3
    context.beginPath()
    context.moveTo(unicornX - 25, unicornY - 2)
    context.bezierCurveTo(unicornX - 47, unicornY - 8, unicornX - 45, unicornY + 10, unicornX - 38, unicornY + 17)
    context.stroke()

    // A shaded body with a natural shoulder and rib line.
    const bodyGradient = context.createLinearGradient(unicornX - 30, unicornY - 14, unicornX + 25, unicornY + 14)
    bodyGradient.addColorStop(0, '#fffaff')
    bodyGradient.addColorStop(0.55, coat)
    bodyGradient.addColorStop(1, '#c8b1d6')
    context.fillStyle = bodyGradient
    context.beginPath()
    context.ellipse(unicornX, unicornY, 32, 15, -0.04, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = outline
    context.lineWidth = 1.2
    context.stroke()
    context.strokeStyle = 'rgba(124, 87, 143, 0.34)'
    context.lineWidth = 1
    context.beginPath()
    context.arc(unicornX - 1, unicornY + 1, 15, Math.PI * 0.15, Math.PI * 1.05)
    context.stroke()

    // Sloping neck, head and muzzle follow a horse anatomy rather than a blob.
    const neckGradient = context.createLinearGradient(unicornX + 2, unicornY - 44, unicornX + 29, unicornY + 5)
    neckGradient.addColorStop(0, '#fffaff')
    neckGradient.addColorStop(1, '#c4add2')
    context.fillStyle = neckGradient
    context.beginPath()
    context.moveTo(unicornX + 5, unicornY + 5)
    context.bezierCurveTo(unicornX + 3, unicornY - 13, unicornX + 10, unicornY - 38, unicornX + 25, unicornY - 49)
    context.lineTo(unicornX + 39, unicornY - 40)
    context.bezierCurveTo(unicornX + 26, unicornY - 20, unicornX + 25, unicornY - 4, unicornX + 25, unicornY + 7)
    context.closePath()
    context.fill()
    context.strokeStyle = outline
    context.lineWidth = 1.2
    context.stroke()

    const headGradient = context.createLinearGradient(unicornX + 25, unicornY - 57, unicornX + 58, unicornY - 33)
    headGradient.addColorStop(0, '#fffaff')
    headGradient.addColorStop(1, '#c4add2')
    context.fillStyle = headGradient
    context.beginPath()
    context.ellipse(unicornX + 40, unicornY - 52, 19, 12, -0.12, 0, Math.PI * 2)
    context.fill()
    context.beginPath()
    context.ellipse(unicornX + 55, unicornY - 47, 10, 8, 0.08, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = outline
    context.lineWidth = 1.1
    context.stroke()

    // Mane, ears and horn add the recognizable unicorn details.
    context.strokeStyle = '#8c5fb5'
    context.lineWidth = 5
    context.beginPath()
    context.moveTo(unicornX + 8, unicornY - 12)
    context.bezierCurveTo(unicornX - 2, unicornY - 28, unicornX + 8, unicornY - 45, unicornX + 25, unicornY - 55)
    context.stroke()
    context.strokeStyle = '#e99bd8'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(unicornX + 10, unicornY - 14)
    context.bezierCurveTo(unicornX + 3, unicornY - 30, unicornX + 14, unicornY - 43, unicornX + 28, unicornY - 53)
    context.stroke()
    context.fillStyle = '#f4d9f4'
    context.beginPath()
    context.moveTo(unicornX + 29, unicornY - 61)
    context.lineTo(unicornX + 32, unicornY - 76)
    context.lineTo(unicornX + 38, unicornY - 60)
    context.closePath()
    context.fill()
    context.strokeStyle = outline
    context.lineWidth = 1
    context.stroke()
    context.fillStyle = '#d38bcf'
    context.beginPath()
    context.moveTo(unicornX + 29, unicornY - 61)
    context.lineTo(unicornX + 24, unicornY - 72)
    context.lineTo(unicornX + 29, unicornY - 65)
    context.closePath()
    context.fill()
    context.fillStyle = '#f3c1e8'
    context.beginPath()
    context.moveTo(unicornX + 29, unicornY - 57)
    context.lineTo(unicornX + 25, unicornY - 67)
    context.lineTo(unicornX + 35, unicornY - 59)
    context.closePath()
    context.fill()

    // Face: eye, catchlight, nostril and a soft cheek mark.
    context.fillStyle = '#342642'
    context.beginPath()
    context.ellipse(unicornX + 48, unicornY - 55, 3, 3.5, -0.2, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#ffffff'
    context.beginPath()
    context.arc(unicornX + 49, unicornY - 56, 1, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#6e476f'
    context.beginPath()
    context.ellipse(unicornX + 62, unicornY - 47, 1.7, 1.2, 0, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = 'rgba(226, 125, 185, 0.55)'
    context.beginPath()
    context.arc(unicornX + 50, unicornY - 44, 3, 0, Math.PI * 2)
    context.fill()

    // Front legs are placed over the body to create depth.
    drawLeg(unicornX + 17, Math.PI * 0.3, false)
    drawLeg(unicornX + 28, Math.PI * 1.3, false)

    context.fillStyle = '#ffffff'
    context.font = '600 14px sans-serif'
    const chapter = progress < 0.25 ? 'The wish' : progress < 0.5 ? 'The falling star' : progress < 0.75 ? 'The rainbow path' : 'The moonlit castle'
    context.fillText(chapter, 14, 22)
    context.font = '12px sans-serif'
    context.fillStyle = 'rgba(255, 255, 255, 0.72)'
    context.fillText(`${format.toUpperCase()} · ${seconds.toFixed(1)}s · ${frameRate} fps`, 14, 39)

    const preview = elements.frameApiPreview
    if (preview) {
        preview.width = width
        preview.height = height
        const previewContext = preview.getContext('2d')
        previewContext?.drawImage(canvas, 0, 0)
    }

    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob
            ? resolve(blob)
            : reject(new Error(`The browser could not encode frame ${index + 1}`)), format === 'png' ? 'image/png' : 'image/jpeg', format === 'jpeg' ? 0.9 : undefined)
    })
}

/** Add a representative generated frame to the scrollable two-column viewer. */
const addFrameGalleryImage = (image: Blob, index: number, frameCount: number, frameRate: number): void => {
    if (!elements.frameGallery) {
        return
    }

    const sampleStep = Math.max(1, Math.ceil(frameCount / 60))
    if (index % sampleStep !== 0 && index !== frameCount - 1) {
        return
    }

    const url = URL.createObjectURL(image)
    state.frameGalleryUrls.push(url)
    if (state.frameGalleryUrls.length === 1) {
        elements.frameGallery.querySelector('.frame-gallery-empty')?.remove()
    }
    const figure = document.createElement('figure')
    figure.className = 'frame-gallery-item'
    const imageElement = document.createElement('img')
    imageElement.src = url
    imageElement.loading = 'lazy'
    imageElement.alt = `Unicorn story frame ${index + 1}`
    const caption = document.createElement('figcaption')
    caption.textContent = `Frame ${index + 1} · ${(index / frameRate).toFixed(2)} s`
    figure.append(imageElement, caption)
    elements.frameGallery.append(figure)
    if (elements.frameGalleryLabel) {
        elements.frameGalleryLabel.textContent = `View frames (${state.frameGalleryUrls.length})`
    }
}

/** Decode a generated image to the raw RGBA bytes expected by the encoder. */
const decodeFrameApiImage = async (image: Blob): Promise<Uint8Array> => {
    const bitmap = await createImageBitmap(image)
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const context = canvas.getContext('2d', {willReadFrequently: true})
    if (!context) {
        bitmap.close()
        throw new Error('The browser could not create a frame decoding canvas')
    }

    context.drawImage(bitmap, 0, 0, 320, 180)
    bitmap.close()
    return new Uint8Array(context.getImageData(0, 0, 320, 180).data)
}

/** Download the output of the unicorn frame demo and show it inline. */
const showFrameApiOutput = async (job: FrameApiJob): Promise<void> => {
    const path = `/v1/jobs/${job.id}/output`
    const call = startFrameApiCall('GET', path)
    const headers = state.token ? {Authorization: `Bearer ${state.token}`} : undefined
    try {
        const response = await fetch(`/encoder${path}`, {headers, signal: state.frameApiAbortController?.signal})
        if (!response.ok) {
            throw new Error(`Output download failed with status ${response.status}`)
        }
        const url = URL.createObjectURL(await response.blob())
        state.frameApiOutputUrl = url
        if (elements.frameApiOutputVideo) {
            elements.frameApiOutputVideo.src = url
            elements.frameApiOutputVideo.hidden = false
        }
        finishFrameApiCall(call, response.status)
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Output download failed'
        finishFrameApiCall(call, 0, message)
        throw error
    }
}

/** Generate every story image and keep it in memory before any encode request. */
const generateUnicornFrames = async (): Promise<void> => {
    if (state.frameApiAbortController) {
        return
    }

    if (!await checkEncoderHealth()) {
        if (elements.frameApiMessage) {
            elements.frameApiMessage.textContent = 'Start LGS1920 Encoder before generating the story.'
        }
        return
    }

    resetFrameApi()
    state.frameApiAbortController = new AbortController()
    elements.runFrameApiButton?.setAttribute('loading', '')
    elements.runFrameApiButton?.setAttribute('disabled', '')
    elements.stopFrameApiButton?.removeAttribute('disabled')
    const selectedFormat = controlValue(elements.frameApiFormat, 'png')
    const format = selectedFormat === 'jpeg' ? 'jpeg' : 'png'
    const frameRate = Math.min(60, Math.max(1, controlNumber(elements.frameApiRate, 30)))
    const frameCount = UNICORN_DURATION_SECONDS * frameRate

    try {
        elements.frameApiStatus?.setAttribute('variant', 'brand')
        if (elements.frameApiStatus) {
            elements.frameApiStatus.textContent = 'preparing'
        }
        if (elements.frameApiMessage) {
            elements.frameApiMessage.textContent = `Drawing all ${frameCount} ${format.toUpperCase()} frames before encoding...`
        }

        for (let index = 0; index < frameCount; index += 1) {
            const image = await createFrameApiImage(index, format, frameCount, frameRate)
            state.preparedFrameImages.push(image)
            addFrameGalleryImage(image, index, frameCount, frameRate)
            const progress = Math.round(((index + 1) / frameCount) * 100)
            if (elements.frameApiProgress) {
                elements.frameApiProgress.value = String(progress)
                elements.frameApiProgress.setAttribute('label', `Frame preparation ${progress}%`)
                elements.frameApiProgress.textContent = `${progress}%`
            }
        }

        state.preparedFrameRate = frameRate
        state.preparedFrameFormat = format
        elements.frameApiStatus?.setAttribute('variant', 'success')
        if (elements.frameApiStatus) {
            elements.frameApiStatus.textContent = 'ready to encode'
        }
        if (elements.frameApiMessage) {
            elements.frameApiMessage.textContent = `All ${frameCount} frames are ready. Open View frames, then start the encoding when you are ready.`
        }
        elements.encodeFrameApiButton?.removeAttribute('disabled')
    }
    catch (error) {
        const message = error instanceof DOMException && error.name === 'AbortError'
            ? 'Frame preparation stopped'
            : error instanceof Error ? error.message : 'The unicorn frames could not be generated'
        elements.frameApiStatus?.setAttribute('variant', message === 'Frame preparation stopped' ? 'neutral' : 'danger')
        if (elements.frameApiStatus) {
            elements.frameApiStatus.textContent = message === 'Frame preparation stopped' ? 'stopped' : 'error'
        }
        if (elements.frameApiMessage) {
            elements.frameApiMessage.textContent = message
        }
    }
    finally {
        state.frameApiAbortController = undefined
        elements.runFrameApiButton?.removeAttribute('loading')
        elements.stopFrameApiButton?.setAttribute('disabled', '')
        void checkEncoderHealth()
    }
}

/** Upload the already generated images and encode them as one MP4. */
const encodePreparedFrames = async (): Promise<void> => {
    if (state.frameApiAbortController || state.preparedFrameImages.length === 0 || !state.preparedFrameRate || !state.preparedFrameFormat) {
        return
    }

    state.frameApiAbortController = new AbortController()
    elements.runFrameApiButton?.setAttribute('disabled', '')
    elements.encodeFrameApiButton?.setAttribute('loading', '')
    elements.encodeFrameApiButton?.setAttribute('disabled', '')
    elements.stopFrameApiButton?.removeAttribute('disabled')
    const images = state.preparedFrameImages
    const frameRate = state.preparedFrameRate
    const format = state.preparedFrameFormat

    try {
        await frameApiJson<unknown>('GET', '/v1/health')
        const session = await frameApiJson<{token: string}>('GET', '/v1/session')
        state.token = session.token
        await frameApiJson<unknown>('GET', '/v1/jobs')
        const job = await frameApiJson<FrameApiJob>('POST', '/v1/jobs', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                type: 'frames',
                width: 320,
                height: 180,
                frameRate,
                frameCount: images.length,
                options: {quality: 'low', hardwareAcceleration: 'prefer-software'},
            }),
        })
        renderFrameApiJob(job)
        if (elements.frameApiMessage) {
            elements.frameApiMessage.textContent = `Uploading the prepared ${format.toUpperCase()} story frames...`
        }

        const eventsPromise = observeFrameApiEvents(job.id)
        let currentJob = job
        for (let index = 0; index < images.length; index += 1) {
            const rgba = await decodeFrameApiImage(images[index])
            currentJob = await frameApiJson<FrameApiJob>('POST', `/v1/jobs/${job.id}/frames`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Frame-Index': String(index),
                },
                body: new Blob([rgba.buffer as ArrayBuffer], {type: 'application/octet-stream'}),
            })
            renderFrameApiJob(currentJob)
        }

        currentJob = await frameApiJson<FrameApiJob>('POST', `/v1/jobs/${job.id}/complete`, {method: 'POST'})
        renderFrameApiJob(currentJob)
        currentJob = await waitForFrameApiCompletion(currentJob)
        await eventsPromise
        if (currentJob.status === 'completed') {
            await showFrameApiOutput(currentJob)
        }
        if (elements.frameApiMessage) {
            elements.frameApiMessage.textContent = `Done. The ${UNICORN_DURATION_SECONDS}-second unicorn video was encoded from the prepared frames.`
        }
    }
    catch (error) {
        const message = error instanceof DOMException && error.name === 'AbortError'
            ? 'Frame encoding stopped'
            : error instanceof Error ? error.message : 'The prepared frames could not be encoded'
        elements.frameApiStatus?.setAttribute('variant', message === 'Frame encoding stopped' ? 'neutral' : 'danger')
        if (elements.frameApiStatus) {
            elements.frameApiStatus.textContent = message === 'Frame encoding stopped' ? 'stopped' : 'error'
        }
        if (elements.frameApiMessage) {
            elements.frameApiMessage.textContent = message
        }
    }
    finally {
        state.frameApiAbortController = undefined
        elements.encodeFrameApiButton?.removeAttribute('loading')
        elements.stopFrameApiButton?.setAttribute('disabled', '')
        void checkEncoderHealth()
    }
}

/** Stop frame generation or encoding. */
const stopFrameApiTest = (): void => {
    state.frameApiAbortController?.abort()
}


/** Wait for a video element to seek to one captured timestamp. */
const seekVideo = async (video: HTMLVideoElement, timestamp: number): Promise<void> => {
    if (Math.abs(video.currentTime - timestamp) < 0.005 && video.readyState >= 2) {
        return
    }

    await new Promise<void>((resolve, reject) => {
        const onSeeked = (): void => resolve()
        const onError = (): void => reject(new Error('The source video could not seek to the requested frame'))
        video.addEventListener('seeked', onSeeked, {once: true})
        video.addEventListener('error', onError, {once: true})
        video.currentTime = timestamp
    })
}

/** Draw one source timestamp into an RGBA canvas and return its pixel data. */
const captureFrame = async (timestamp: number, width: number, height: number): Promise<Uint8ClampedArray> => {
    const video = elements.sourceVideo
    const canvas = elements.requestFramePreview
    if (!video || !canvas) {
        throw new Error('The source preview is unavailable')
    }

    await seekVideo(video, timestamp)
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', {willReadFrequently: true})
    if (!context) {
        throw new Error('The frame preview canvas is unavailable')
    }

    context.drawImage(video, 0, 0, width, height)
    elements.sourceFrameLabel!.textContent = `Frame at ${formatTime(timestamp)}`
    elements.sourceTime!.textContent = formatTime(timestamp)
    return context.getImageData(0, 0, width, height).data
}

/** Format a video timestamp for the pipeline cards. */
const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
    const remaining = (seconds % 60).toFixed(3).padStart(6, '0')
    return `${minutes}:${remaining}`
}

/** Wait without blocking the browser event loop. */
const wait = async (milliseconds: number): Promise<void> => {
    await new Promise(resolve => window.setTimeout(resolve, milliseconds))
}

/** Enable and disable controls while a stream is running. */
const setRunning = (running: boolean): void => {
    elements.startButton?.toggleAttribute('disabled', running)
    elements.stopButton?.toggleAttribute('disabled', !running)
}

/** Poll one job until the encoder reaches a terminal phase. */
const waitForCompletion = async (job: DemoJob): Promise<DemoJob> => {
    while (true) {
        await wait(250)
        const response = await apiJson<DemoJob>(`/v1/jobs/${job.id}`)
        state.job = response.data
        updatePipeline(response.data, response.status)
        if (response.data.phase === 'completed') {
            return response.data
        }
        if (['failed', 'canceled'].includes(response.data.phase)) {
            throw new Error(response.data.error ?? `The encoder ended in ${response.data.phase}`)
        }
    }
}

/** Play the source and reconstructed target videos together at their natural speed. */
const playRealTimeResult = async (): Promise<void> => {
    const source = elements.sourceVideo
    const target = elements.targetVideo
    if (!source || !target) {
        return
    }

    source.currentTime = 0
    target.currentTime = 0
    await Promise.allSettled([source.play(), target.play()])
}

/** Run the complete frame-by-frame capture and encoding demonstration. */
const runDemo = async (): Promise<void> => {
    const source = elements.sourceVideo
    if (!source || source.readyState < 1) {
        throw new Error('Wait for the source video metadata to load')
    }

    if (!await checkEncoderHealth()) {
        setMessage('Start LGS1920 Encoder first, then reload this demo.', true)
        log('GET /encoder/health → unavailable')
        return
    }

    state.abortController = new AbortController()
    state.logLines = []
    setRunning(true)
    setMessage('Encoder ready. Initializing the frame stream…')
    log('GET /encoder/health → 200')
    log('GET /encoder/v1/session')

    try {
        const session = await fetch('/encoder/v1/session', {cache: 'no-store', signal: state.abortController.signal})
        const sessionData = await session.json() as {token: string}
        if (!session.ok || !sessionData.token) {
            throw new Error('The encoder session could not be initialized')
        }
        state.token = sessionData.token

        const duration = controlNumber(elements.durationInput, 10)
        const frameRate = controlNumber(elements.frameRateInput, 30)
        const frameWidth = Math.round(controlNumber(elements.frameWidthInput, 640) / 2) * 2
        const frameHeight = Math.round(controlNumber(elements.frameHeightInput, 534) / 2) * 2
        const frameCount = Math.max(1, Math.round(duration * frameRate))
        const outputWidth = controlNumber(elements.outputWidthInput, 0)
        const outputHeight = controlNumber(elements.outputHeightInput, 0)
        const quality = controlValue(elements.qualityInput, 'medium')
        const hardwareAcceleration = controlValue(elements.accelerationInput, 'no-preference')
        const pacing = controlValue(elements.pacingInput, 'real-time')

        const createJob = await apiJson<DemoJob>('/v1/jobs', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                type: 'frames',
                width: frameWidth,
                height: frameHeight,
                frameRate,
                frameCount,
                options: {
                    quality,
                    hardwareAcceleration,
                    width: outputWidth || undefined,
                    height: outputHeight || undefined,
                },
            }),
        })
        state.job = createJob.data
        updatePipeline(createJob.data, createJob.status)
        elements.encoderStatus!.textContent = 'Encoder: connected'
        elements.encoderStatus!.setAttribute('variant', 'success')
        elements.requestRoute!.textContent = `POST /encoder/v1/jobs/${createJob.data.id}/frames`
        setMessage(`${frameCount} frames initialized at ${frameRate} fps (${duration} seconds)`)
        log(`POST /encoder/v1/jobs → ${createJob.data.id}`)

        const startedAt = performance.now()
        const frameDuration = 1 / frameRate
        for (let index = 0; index < frameCount; index += 1) {
            const timestamp = Math.min(index * frameDuration, Math.max(0, source.duration - 0.001))
            const frame = await captureFrame(timestamp, frameWidth, frameHeight)
            const frameBytes = new Uint8Array(frame.byteLength)
            frameBytes.set(frame)
            const response = await apiJson<DemoJob>(`/v1/jobs/${createJob.data.id}/frames`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Frame-Index': String(index),
                },
                body: frameBytes.buffer,
            })
            state.job = response.data
            updatePipeline(response.data, response.status)
            log(`Frame ${index + 1}/${frameCount} → ${response.status} · ${Math.round(response.data.progress * 100)}%`)

            if (pacing === 'real-time') {
                const targetElapsed = (index + 1) * frameDuration * 1000
                await wait(Math.max(0, targetElapsed - (performance.now() - startedAt)))
            }
        }

        setMessage('All frames received. Closing the stream and encoding MP4…')
        const complete = await apiJson<DemoJob>(`/v1/jobs/${createJob.data.id}/complete`, {method: 'POST'})
        state.job = complete.data
        updatePipeline(complete.data, complete.status)
        log(`POST /encoder/v1/jobs/${createJob.data.id}/complete → ${complete.status}`)

        const finalJob = await waitForCompletion(complete.data)
        const outputResponse = await fetch(`/encoder${finalJob.outputUrl ?? `/v1/jobs/${finalJob.id}/output`}`, {
            headers: {Authorization: `Bearer ${state.token}`},
            signal: state.abortController.signal,
        })
        if (!outputResponse.ok) {
            throw new Error(`The encoded video could not be downloaded (status ${outputResponse.status})`)
        }

        state.targetUrl = URL.createObjectURL(await outputResponse.blob())
        if (elements.targetVideo && elements.targetStage && elements.targetPlaceholder) {
            elements.targetVideo.src = state.targetUrl
            elements.targetVideo.hidden = false
            elements.targetStage.hidden = false
            elements.targetPlaceholder.hidden = true
            elements.targetVideo.addEventListener('timeupdate', () => {
                elements.targetTime!.textContent = formatTime(elements.targetVideo!.currentTime)
            })
        }
        elements.targetStatus!.textContent = 'Ready · real-time playback'
        setMessage('Done. Source and target are ready to play together at real speed.')
        log(`GET ${finalJob.outputUrl} → ready`)
        await playRealTimeResult()
    }
    catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            setMessage('Demo stopped')
            log('Stream stopped by the user')
        }
        else {
            const message = error instanceof Error ? error.message : 'The frame demo failed'
            setMessage(message, true)
            log(`Error · ${message}`)
            elements.encoderStatus!.textContent = 'Encoder: error'
            elements.encoderStatus!.setAttribute('variant', 'danger')
        }
    }
    finally {
        setRunning(false)
        state.abortController = undefined
    }
}

/** Stop the active capture and encoding request chain. */
const stopDemo = (): void => {
    state.abortController?.abort()
    elements.sourceVideo?.pause()
    elements.targetVideo?.pause()
}

configureDemoMode()

void checkEncoderHealth().then(ready => {
    if (!ready) {
        setMessage('Start LGS1920 Encoder first, then reload this demo.', true)
    }
})

window.setInterval(() => {
    if (!state.abortController && !state.frameApiAbortController) {
        void checkEncoderHealth()
    }
}, 5000)

elements.sourceVideo?.addEventListener('loadedmetadata', () => {
    const ratio = elements.sourceVideo!.videoHeight / elements.sourceVideo!.videoWidth
    const width = controlNumber(elements.frameWidthInput, 640)
    if (elements.frameHeightInput && Number(elements.frameHeightInput.value) === 534) {
        elements.frameHeightInput.value = String(Math.round(width * ratio / 2) * 2)
    }

    const sourceDuration = Math.max(0.1, elements.sourceVideo!.duration)
    if (elements.durationInput) {
        elements.durationInput.setAttribute('max', sourceDuration.toFixed(3))
        elements.durationInput.value = sourceDuration.toFixed(3)
    }
})
elements.startButton?.addEventListener('click', () => void runDemo())
elements.stopButton?.addEventListener('click', stopDemo)
elements.runFrameApiButton?.addEventListener('click', () => void generateUnicornFrames())
elements.encodeFrameApiButton?.addEventListener('click', () => void encodePreparedFrames())
elements.stopFrameApiButton?.addEventListener('click', stopFrameApiTest)
elements.videoSourceInput?.addEventListener('change', () => {
    const selectedSource = controlValue(elements.videoSourceInput, 'contemplation')
    const url = new URL(window.location.href)
    if (selectedSource === 'vtt') {
        url.searchParams.set('demo', 'vtt')
    }
    else {
        url.searchParams.delete('demo')
    }
    window.location.assign(url.toString())
})
elements.frameGalleryButton?.addEventListener('click', () => {
    if (elements.frameGalleryDialog) {
        elements.frameGalleryDialog.open = true
    }
})
elements.sourceVideo?.addEventListener('error', () => {
    elements.encoderStatus!.textContent = 'Source: unavailable'
    elements.encoderStatus!.setAttribute('variant', 'danger')
})
