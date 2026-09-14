// The Alma IDE's voice orb, drawn in this composer: a mic, the mode, and
// the words the orb heard while the mic was open. The engine — the
// microphone, the Gemini Live session, the tidy-up, the delivery into this
// session as a message — stays in the editor; this is only its face here,
// through `/api/alma/*`. It renders nothing outside the editor.
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import {
  almaVoiceTalk,
  getAlmaVoiceState,
  readAlmaBus,
  setAlmaVoiceMode,
  type AlmaBusEvent,
  type AlmaVoiceMode,
  type AlmaVoiceState,
} from "../api";
import { m } from "../paraglide/messages.js";
import { IconButton } from "./ui/IconButton";
import { Button } from "./ui/Button";
import { usePopover } from "./ModelPicker";

/** How often the orb is asked how it is. Loopback, one small JSON; a
 * second's lag on the mic icon is fine, a stuck icon is not. */
const STATE_POLL_MS = 1000;
/** How often the transcript is read while the mic is open — the same cadence
 * the editor's own relay uses. */
const BUS_POLL_MS = 900;
/** How long a heard sentence stays on screen after the last one. The editor
 * gathers utterances for three seconds before sending them into the session;
 * by then the message itself is in the transcript above. */
const HEARD_LINGER_MS = 6000;

const MODES: AlmaVoiceMode[] = ["plan", "assistant", "build", "transcribe"];

function modeLabel(mode: AlmaVoiceMode): string {
  switch (mode) {
    case "plan":
      return m.alma_voice_mode_plan();
    case "assistant":
      return m.alma_voice_mode_assistant();
    case "build":
      return m.alma_voice_mode_build();
    case "transcribe":
      return m.alma_voice_mode_transcribe();
  }
}

type Props = {
  /** Whether the composer belongs to an open session. The mic in Plan mode
   * dictates into the session on screen, so without one it stays off. */
  sessionOpen: boolean;
};

export function AlmaVoiceControls({ sessionOpen }: Props) {
  const [state, setState] = useState<AlmaVoiceState | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const modes = usePopover();
  const cursor = useRef(0);
  const heardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getAlmaVoiceState());
    } catch {
      // The editor is not answering; the controls draw as "off" until it does.
      setState(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), STATE_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const listening = state?.listening === true;

  // Show what the orb heard while the mic is open. The cursor starts at the
  // bus head so an old transcript does not replay on the first open.
  useEffect(() => {
    if (!listening) return;
    let cancelled = false;
    const showHeard = (text: string) => {
      setHeard(text);
      if (heardTimer.current) clearTimeout(heardTimer.current);
      heardTimer.current = setTimeout(() => setHeard(null), HEARD_LINGER_MS);
    };
    const poll = async () => {
      try {
        const reply = await readAlmaBus(cursor.current);
        if (cancelled || !reply.ok) return;
        const first = cursor.current === 0;
        cursor.current = reply.next_since;
        if (first) return;
        const spoken = reply.events.filter(
          (event: AlmaBusEvent) => event.source === "user" && event.kind === "speech" && event.text.trim(),
        );
        const last = spoken[spoken.length - 1];
        if (last) showHeard(last.text);
      } catch {
        // Missing one poll only delays the line by a beat.
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), BUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [listening]);

  useEffect(
    () => () => {
      if (heardTimer.current) clearTimeout(heardTimer.current);
    },
    [],
  );

  const toggleMic = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (listening || state?.speaking) {
        setState(await almaVoiceTalk("stop"));
        return;
      }
      // Talking into a session is Plan mode: the words go into the
      // transcript above and the orb reads the replies aloud. Anything else
      // is the editor's business and is chosen from the menu.
      if (state?.mode !== "plan") await setAlmaVoiceMode("plan");
      setState(await almaVoiceTalk("start"));
    } catch {
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [busy, listening, refresh, state?.mode, state?.speaking]);

  const chooseMode = useCallback(
    async (mode: AlmaVoiceMode) => {
      modes.setOpen(false);
      try {
        setState(await setAlmaVoiceMode(mode));
      } catch {
        await refresh();
      }
    },
    [modes, refresh],
  );

  const off = state === null || state.ok === false;
  const mode = state?.mode ?? "plan";
  const title = off
    ? m.alma_voice_unavailable()
    : state.speaking
      ? m.alma_voice_stop()
      : listening
        ? m.alma_voice_stop_listening()
        : state.starting
          ? m.alma_voice_starting()
          : m.alma_voice_talk();

  return (
    <div className="alma-voice flex min-w-0 items-center gap-1">
      {heard && (
        <span
          className="alma-voice-heard hidden max-w-60 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-subtext sm:inline"
          title={heard}
        >
          {heard}
        </span>
      )}
      <div className="option-picker relative inline-flex shrink-0" ref={modes.ref}>
        <Button
          type="button"
          variant="ghost"
          size="small"
          className="alma-voice-mode text-subtext"
          title={m.alma_voice_mode()}
          aria-label={m.alma_voice_mode()}
          aria-haspopup="menu"
          aria-expanded={modes.open}
          disabled={off}
          onClick={() => modes.setOpen((open) => !open)}
        >
          {modeLabel(mode)}
        </Button>
        {modes.open && (
          <div
            role="menu"
            className="absolute bottom-[calc(100%_+_8px)] end-0 z-50 flex min-w-40 flex-col gap-0.5 rounded-md border border-border bg-background p-1 shadow-dropdown"
          >
            {MODES.map((candidate) => (
              <Button
                key={candidate}
                type="button"
                role="menuitemradio"
                aria-checked={candidate === mode}
                variant="ghost"
                size="small"
                active={candidate === mode}
                className="justify-start"
                onClick={() => void chooseMode(candidate)}
              >
                {modeLabel(candidate)}
              </Button>
            ))}
          </div>
        )}
      </div>
      <IconButton
        type="button"
        className="alma-voice-mic"
        active={listening || state?.speaking === true}
        title={title}
        aria-label={title}
        aria-pressed={listening}
        disabled={off || busy || (!sessionOpen && !listening)}
        onClick={() => void toggleMic()}
      >
        {state?.speaking ? <Square size={16} /> : <Mic size={16} className={listening ? "text-primary" : undefined} />}
      </IconButton>
    </div>
  );
}
