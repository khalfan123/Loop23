# Bedrock / Polly outbound-media latency

## Anchors (do not conflate)

| Anchor | Meaning | Not |
|--------|---------|-----|
| **lastSpeechFrameAtMs** | Last accepted speech-energy μ-law frame at ingestion | Silence-timer fire |
| **endpointDetectedAtMs** | Silence / VAD timer fire (includes debounce) | Pure acoustic EOS without debounce |
| **turnReadyAtMs** | Transcript accepted by inbound gate | Acoustic EOS / STT-complete-as-EOS |
| **first outbound** | First Twilio Media Streams `media` WebSocket **enqueue** | Caller-heard / playout |

`endpointDetectedTo…` intervals **include** VAD debounce. They must never be labeled as
“EOS latency with debounce removed.” Prefer `lastSpeechFrameTo…` when `acousticEosKnown`.

## Turn tokens

`beginUserTurn` / `beginStandaloneOutbound` mint an immutable `turnToken` stored on the
session and passed through `synthesizeAndSend` → `sendMulawToTwilio`. After interrupt or a
newer turn, stale tokens are rejected before enqueue, callbacks, and reply first-audio metrics.

## Purposes

`user_turn_reply` | `filler` | `greeting` | `rejection_reprompt` | `apology`

Only `user_turn_reply` consumes the per-turn first-audio metric slot.

## Metric version

- `speech_frame_and_endpoint_to_first_outbound_media_v1`
- `measurementPoint`: `twilio_media_ws_enqueue`
- `callerHeard`: always `false`
