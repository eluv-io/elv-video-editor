import {observable, action} from "mobx";

class ControlStore {
  @observable controlMap;
  @observable modifiers = {
    alt: false,
    control: false,
    shift: false,
    meta: false
  };

  constructor(rootStore) {
    this.rootStore = rootStore;

    this.InitializeControlMap();
  }

  @action.bound
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

  @action.bound
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

    if(!down) { return; }

    // Handle events only available on keydown - arrow keys and control / shift modified keys
    const isArrowKey = ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(event.key.toLowerCase());

    if(this.modifiers.control || this.modifiers.shift || isArrowKey) {
      this.HandleInput(event);
    }
  }

  @action.bound
  HandleInput(event) {
    // Disable controls when using input element
    if(document.activeElement && document.activeElement.tagName.toLowerCase() === "input") {
      return;
    }

    const actionMap = this.controlMap[event.key] || {};

    let action;
    if(!action && this.modifiers.shift) {
      action = actionMap.shiftAction;
    }

    if(!action && this.modifiers.alt) {
      action = actionMap.altAction;
    }

    if(!action && this.modifiers.control) {
      action = actionMap.controlAction;
    }

    if(!action) {
      action = actionMap.action;
    }

    if(action) {
      event.preventDefault();
      action(event);
    }
  }

  @action.bound
  Save() {
    this.rootStore.editStore.Save();
  }

  Undo() {
  }

  Redo() {
  }

  @action.bound
  SeekFrames({frames, seconds}) {
    this.rootStore.videoStore.SeekFrames({frames, seconds});
  }

  @action.bound
  PlayPause() {
    this.rootStore.videoStore.PlayPause();
  }

  @action.bound
  PlayCurrentEntry() {
    this.rootStore.entryStore.PlayCurrentEntry();
  }

  @action.bound
  SetPlaybackRate(rate) {
    this.rootStore.videoStore.SetPlaybackRate(rate);
  }

  @action.bound
  ChangePlaybackRate(delta) {
    this.rootStore.videoStore.ChangePlaybackRate(delta);
  }

  @action.bound
  ToggleFullscreen() {
    this.rootStore.videoStore.ToggleFullscreen();
  }

  @action.bound
  ToggleMuted() {
    this.rootStore.videoStore.ToggleMuted();
  }

  @action.bound
  SetVolume(volume) {
    this.rootStore.videoStore.SetVolume(volume * this.rootStore.videoStore.scale);
  }

  @action.bound
  ChangeVolume(delta) {
    this.rootStore.videoStore.ChangeVolume(delta * this.rootStore.videoStore.scale);
  }

  @action.bound
  ToggleTrackByIndex(index) {
    this.rootStore.trackStore.ToggleTrackByIndex(parseInt(index) - 1);
  }

  // Control definitions

  @observable controls = {
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
