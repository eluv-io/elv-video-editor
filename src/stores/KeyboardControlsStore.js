import {makeAutoObservable} from "mobx";

class ControlStore {
  controlMap;
  modifiers = {
    alt: false,
    control: false,
    shift: false,
    meta: false
  };

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;

    this.InitializeControlMap();
  }

  InitializeControlMap() {
    const controlMap = {};

    Object.values(this.controls).forEach(controls => {
      controls.forEach(schema => {
        const buttons = schema[0];
        const controls = schema[1];

        buttons.forEach(button => {
          controlMap[button] = {};

          if(controls.action) {
            controlMap[button].action = controls.action.action;
          }

          if(controls.shiftAction) {
            controlMap[button].shiftAction = controls.shiftAction.action;
          }

          if(controls.altAction) {
            controlMap[button].altAction = controls.altAction.action;
          }

          if(controls.controlAction) {
            controlMap[button].controlAction = controls.controlAction.action;
          }
        });
      });
    });

    this.controlMap = controlMap;
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
    if(document.activeElement && document.activeElement.tagName.toLowerCase() === "input") {
      return;
    }

    this.HandleModifiers(event);

    if(event.type.toLowerCase() !== "keydown") { return; }

    const actionMap = this.controlMap[event.key] || {};

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
  }

  Redo() {
  }

  SeekFrames({frames, seconds}) {
    this.rootStore.videoStore.SeekFrames({frames, seconds});
  }

  PlayPause() {
    this.rootStore.videoStore.PlayPause();
  }

  PlayCurrentEntry() {
    this.rootStore.entryStore.PlayCurrentEntry();
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
    this.rootStore.videoStore.SetVolume(volume * 100);
  }

  ChangeVolume(delta) {
    this.rootStore.videoStore.ChangeVolume(delta * 100);
  }

  ToggleTrackByIndex(index) {
    this.rootStore.trackStore.ToggleTrackByIndex(parseInt(index) - 1);
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
        ["p", " "],
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
            description: "Play current entry",
            action: this.PlayCurrentEntry
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
        ["-"],
        {
          action: {
            description: "Reduce playback rate by 0.5x",
            action: () => this.ChangePlaybackRate(-0.5)
          }
        }
      ],
      [
        ["["],
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
            description: "Reset playback rate to normal",
            action: () => this.SetPlaybackRate(1)
          }
        }
      ],
      [
        ["]"],
        {
          action: {
            description: "Increase playback rate by 0.1x",
            action: () => this.ChangePlaybackRate(0.1)
          }
        }
      ],
      [
        ["+"],
        {
          action: {
            description: "Increase playback rate by 0.5x",
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
      ],
      [
        [],
        {
          keyLabel: "Scroll (over video or volume control)",
          action: {
            description: "Adjust volume up or down",
            action: () => {}
          }
        }
      ]
    ],
    "Seeking": [
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
        ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        {
          keyLabel: "1-9",
          action: {
            description: "Toggle the specified track",
            action: (event) => this.ToggleTrackByIndex(event.key),
          }
        }
      ],
      [
        [],
        {
          keyLabel: "Shift + Scroll (over track)",
          action: {
            description: "Adjust timeline scale",
            action: () => {}
          }
        }
      ]
    ],
    "Clips": [
      [
        ["\\"],
        {
          action: {
            description: "Play currently selected clip from the beginning",
            action: () => this.PlayClip()
          }
        },
      ],
      /*
      [
        ["Delete", "Backspace"],
        {
          action: {
            description: "Delete currently selected clip",
            action: () => this.DeleteClip()
          }
        },
      ],

       */
      [
        ["{"],
        {
          action: {
            description: "Set Mark In to current playhead position",
            action: () => this.SetMarkIn()
          }
        }
      ],
      [
        ["}"],
        {
          action: {
            description: "Set Mark Out to current playhead position",
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
      /*
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
     */
    ]
  };
}

export default ControlStore;
