import {makeAutoObservable} from "mobx";

class ControlStore {
  controlMap;
  keyboardControlsEnabled = false;
  keyboardControlsActive = false;
  modifiers = {
    alt: false,
    control: false,
    shift: false,
    meta: false
  };

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;

    this.HandleModifiers = this.HandleModifiers.bind(this);
    this.HandleInput = this.HandleInput.bind(this);

    this.InitializeControlMap();
  }

  ToggleKeyboardControls(enabled) {
    this.keyboardControlsEnabled = enabled;
  }

  ToggleKeyboardControlsActive(active) {
    this.keyboardControlsActive = active;
  }

  InitializeControlMap() {
    const controlMap = {};

    Object.values(this.controls).forEach(controls => {
      controls.forEach(schema => {
        const buttons = schema[0];
        const controls = schema[1];

        buttons.forEach(button => {
          controlMap[button] = controlMap[button] || {};

          if(controls.action) {
            controlMap[button].action = controls.action.action.bind(this);
          }

          if(controls.shiftAction) {
            controlMap[button].shiftAction = controls.shiftAction.action.bind(this);
          }

          if(controls.altAction) {
            controlMap[button].altAction = controls.altAction.action.bind(this);
          }

          if(controls.controlAction) {
            controlMap[button].controlAction = controls.controlAction.action.bind(this);
          }
        });
      });
    });

    this.controlMap = controlMap;

    window.onblur = () => this.ToggleKeyboardControlsActive(false);

    document.addEventListener("focusin", this.ToggleKeyboardControlsActive);
  }

  HandleModifiers(event) {
    const down = event.type.toLowerCase() === "keydown";

    switch(event.key.toLowerCase()) {
      case "control":
        this.modifiers.control = down;
        break;
      case "shift":
        this.modifiers.shift = down;
        break;
      case "alt":
        this.modifiers.alt = down;
        break;
      case "meta":
        this.modifiers.meta = down;
        break;
    }
  }

  HandleInput(event) {
    // Disable controls when using input element
    if(
      !this.keyboardControlsEnabled ||
      ["input", "textarea"].includes(event.target?.tagName?.toLowerCase())
    ) {
      return;
    }

    this.HandleModifiers(event);

    if(event.type.toLowerCase() !== "keydown") { return; }

    const actionMap = this.controlMap[event.key] || this.controlMap[event.code] || {};

    const shift = this.modifiers.shift;
    const alt = this.modifiers.alt;
    const ctrl = this.modifiers.control;
    const meta = this.modifiers.meta;

    let action;
    if(!action && shift && !alt && !ctrl && !meta) {
      action = actionMap.shiftAction;
    }

    if(!action && alt && !shift && !ctrl && !meta) {
      action = actionMap.altAction;
    }

    if(!action && ctrl && !shift && !alt && !meta) {
      action = actionMap.controlAction;
    }

    // Shift allowed because it may be needed to produce certain characters
    if(!action && !alt && !ctrl && !meta) {
      action = actionMap.action;
    }

    if(action) {
      event.preventDefault();
      action(event);
    }
  }

  Save() {
    this.rootStore.editStore.Save();
  }

  Undo() {
    this.rootStore.editStore.Undo();
  }

  Redo() {
    this.rootStore.editStore.Redo();
  }

  SeekFrames({frames, seconds}) {
    this.rootStore.videoStore.SeekFrames({frames, seconds});
  }

  SeekProgress(progress) {
    this.rootStore.videoStore.SeekPercentage(progress);
  }

  PlayPause() {
    this.rootStore.videoStore.PlayPause();
  }

  PlayCurrentTag() {
    this.rootStore.tagStore.PlayCurrentTag();
  }

  SetPlaybackRate(rate) {
    this.rootStore.videoStore.SetPlaybackRate(rate);
  }

  ChangePlaybackRate(delta) {
    this.rootStore.videoStore.ChangePlaybackRate(delta);
  }

  ToggleFullscreen() {
    this.rootStore.videoStore.ToggleFullscreen();
  }

  ToggleMuted() {
    this.rootStore.videoStore.ToggleMuted();
  }

  SetVolume(volume) {
    this.rootStore.videoStore.SetVolume(volume);
  }

  ChangeVolume(delta) {
    this.rootStore.videoStore.ChangeVolume(delta);
  }

  ToggleTrackByIndex(index) {
    index = index === 0 ? 9 : index - 1;

    const track = this.rootStore.trackStore.metadataTracks[parseInt(index)];

    if(track) {
      this.rootStore.trackStore.ToggleTrackSelected(track.key);
    }
  }

  ShowAllTracks() {
    this.rootStore.view === "clips" ?
      this.rootStore.trackStore.ResetActiveClipTracks() :
      this.rootStore.trackStore.ResetActiveTracks();
  }

  PlayClip() {
    this.rootStore.videoStore.PlaySegment(this.rootStore.videoStore.clipInFrame, this.rootStore.videoStore.clipOutFrame);
  }

  DeleteClip() {
    if(!this.rootStore.clipStore.selectedClipId) { return; }

    this.rootStore.clipStore.DeleteClip(this.rootStore.clipStore.selectedClipId);
  }

  SetMarkIn() {
    this.rootStore.videoStore.SetClipMark({inFrame: this.rootStore.videoStore.frame});
  }

  SetMarkOut() {
    this.rootStore.videoStore.SetClipMark({outFrame: this.rootStore.videoStore.frame});
  }

  // Control definitions

  controls = {
    "Playback": [
      [
        [" ", "p", "k"],
        {
          action: {
            description: "Play/Pause",
            action: this.PlayPause
          }
        }
      ],
      [
        ["l"],
        {
          action: {
            description: "Play current tag",
            action: this.PlayCurrentTag
          }
        }
      ],
      [
        ["f"],
        {
          action: {
            description: "Toggle fullscreen",
            action: this.ToggleFullscreen
          }
        }
      ],
      [
        ["<"],
        {
          action: {
            description: "Reduce playback rate by 0.5x",
            action: () => this.ChangePlaybackRate(-0.5)
          }
        }
      ],
      [
        [","],
        {
          action: {
            description: "Reduce playback rate by 0.1x",
            action: () => this.ChangePlaybackRate(-0.1)
          }
        }
      ],
      [
        ["="],
        {
          action: {
            description: "Reset playback",
            action: () => this.SetPlaybackRate(1)
          }
        }
      ],
      [
        ["."],
        {
          action: {
            description: "Increase playback rate by 0.1x",
            action: () => this.ChangePlaybackRate(0.1)
          }
        }
      ],
      [
        [">"],
        {
          action: {
            description: "Increase playback rate by 0.1x",
            action: () => this.ChangePlaybackRate(0.5)
          }
        }
      ]
    ],
    "Volume": [
      [
        ["m"],
        {
          action: {
            description: "Toggle mute",
            action: this.ToggleMuted
          }
        }
      ],
      [
        ["ArrowDown"],
        {
          action: {
            description: "Reduce volume by 5%",
            action: () => this.ChangeVolume(-0.05)
          },
          shiftAction: {
            description: "Reduce volume by 25%",
            action: () => this.ChangeVolume(-0.25)
          }
        }
      ],
      [
        ["ArrowUp"],
        {
          action: {
            description: "Increase volume by 5%",
            action: () => this.ChangeVolume(0.05)
          },
          shiftAction: {
            description: "Increase volume by 25%",
            action: () => this.ChangeVolume(0.25)
          }
        }
      ]
    ],
    "Seeking": [
      [
        [
          "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9",
          "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9"
        ],
        {
          keyLabel: "0-9",
          action: {
            description: "Seek from 0% to 90% of the video",
            action: (event) => this.SeekProgress(parseInt(event.key) / 10)
          }
        }
      ],
      [
        ["ArrowLeft"],
        {
          action: {
            description: "Go back 1 frame",
            action: () => this.SeekFrames({frames: -1})
          }
          ,
          shiftAction: {
            description: "Go back 1 second",
            action: () => this.SeekFrames({seconds: -1})
          }
          ,
          altAction: {
            description: "Go back 1 minute",
            action: () => this.SeekFrames({seconds: -60})
          }
        }
      ],
      [
        ["ArrowRight"],
        {
          action: {
            description: "Go forward 1 frame",
            action: () => this.SeekFrames({frames: 1})
          },
          shiftAction: {
            description: "Go forward 1 second",
            action: () => this.SeekFrames({seconds: 1})
          },
          altAction: {
            description: "Go forward 1 minute",
            action: () => this.SeekFrames({seconds: 60})
          }
        }
      ],
    ],
    "Tracks": [
      [
        [
          "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9",
          "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9"
        ],
        {
          keyLabel: "0-9",
          shiftAction: {
            description: "Toggle tag track",
            action: event => this.ToggleTrackByIndex(parseInt(event.code.replace(/\D/g, "")))
          }
        }
      ],
      [
        ["~"],
        {
          action: {
            description: "Enable all tag tracks",
            action: () => this.ShowAllTracks()
          }
        }
      ],
      [
        ["scale"],
        {
          keyLabel: "Control + scroll over timeline",
          action: {
            description: "Zoom timeline",
            action: () => {}
          }
        }
      ],
      [
        ["scroll"],
        {
          keyLabel: "Shift + scroll over timeline, Alt + drag view bar",
          action: {
            description: "Shift timeline view",
            action: () => {}
          }
        },
      ]
    ],
    "Clips": [
      [
        ["\\"],
        {
          action: {
            description: "Play current clip from the beginning",
            action: () => this.PlayClip()
          }
        },
      ],
      [
        ["["],
        {
          action: {
            description: "Set mark in to current time",
            action: () => this.SetMarkIn()
          }
        }
      ],
      [
        ["]"],
        {
          action: {
            description: "Set mark out to current time",
            action: () => this.SetMarkOut()
          }
        }
      ]
    ],
    "Editing": [
      [
        ["s"],
        {
          controlAction: {
            description: "Save",
            action: () => this.Save(),
          }
        }
      ],
      [
        ["z"],
        {
          controlAction: {
            description: "Undo last action",
            action: () => this.Undo(),
          }
        }
      ],
      [
        ["r"],
        {
          controlAction: {
            description: "Redo last action",
            action: () => this.Redo(),
          }
        }
      ]
    ]
  };
}

export default ControlStore;
