import {observable, action} from "mobx";

class ControlStore {
  @observable controlMap;
  @observable enabled = true;

  constructor(rootStore) {
    this.rootStore = rootStore;

    this.InitializeControlMap();
  }

  @action.bound
  EnableControls() {
    this.enabled = true;
  }

  @action.bound
  DisableControls() {
    this.enabled = false;
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

          if (controls.action) {
            controlMap[button].action = controls.action.action;
          }

          if (controls.shiftAction) {
            controlMap[button].shiftAction = controls.shiftAction.action;
          }

          if (controls.altAction) {
            controlMap[button].altAction = controls.altAction.action;
          }
        });
      });
    });

    this.controlMap = controlMap;
  }

  RegisterControlListener() {
    document.addEventListener("keydown", this.HandleInput);
  }

  UnregisterControlListener() {
    document.removeEventListener("keydown", this.HandleInput);
  }

  @action.bound
  HandleInput(event) {
    if(!this.enabled) { return; }

    const actionMap = this.controlMap[event.key] || {};

    let action;
    if(!action && event.shiftKey) {
      action = actionMap.shiftAction;
    }

    if(!action && event.altKey) {
      action = actionMap.altAction;
    }

    if(!action && event.ctrlKey) {
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
      ]
    ]
  };
}

export default ControlStore;
