import React from "react";
import {inject, observer} from "mobx-react";
import KeyboardIcon from "../../static/icons/Keyboard.svg";
import {ImageIcon} from "elv-components-js";
import ToolTip from "elv-components-js/src/components/Tooltip";

// Better names for keys
const ControlMap = {
  " ": "Space",
  "ArrowLeft": "←",
  "ArrowUp": "↑",
  "ArrowRight": "→",
  "ArrowDown": "↓"
};

@inject("keyboardControls")
@observer
class KeyboardControls extends React.Component {
  FormatControls(controls, modifier) {
    return controls.map(control => {
      control = ControlMap[control] || control.toUpperCase();

      if(modifier) {
        control = `${modifier} + ${control}`;
      }

      return control;
    });
  }

  Control(controls, action, modifier) {
    controls = this.FormatControls(controls, modifier);

    const labels = controls.map(control =>
      <label key={`keyboard-control-label-${control}`} className="control-label">{control}</label>
    );

    return (
      <div key={`keyboard-control-${controls}`} className="control-group">
        <div className="control-labels">
          { labels }
        </div>
        <div className="control-description">{action.description}</div>
      </div>
    );
  }

  ControlGroup(controls, actions) {
    if(actions.keyLabel) {
      controls = [ actions.keyLabel ];
    }

    let controlGroups = [];
    if(actions.action) {
      controlGroups.push(this.Control(controls, actions.action));
    }

    if(actions.shiftAction) {
      controlGroups.push(this.Control(controls, actions.shiftAction, "Shift"));
    }

    if(actions.altAction) {
      controlGroups.push(this.Control(controls, actions.altAction, "Alt"));
    }

    if(actions.controlAction) {
      controlGroups.push(this.Control(controls, actions.controlAction, "Ctrl"));
    }

    return controlGroups;
  }

  ControlSection(section, controls) {
    const controlGroups = controls.map(controlGroup =>
      this.ControlGroup(controlGroup[0], controlGroup[1])
    );

    return (
      <div key={`keyboard-controls-${section}`} className="control-section">
        <h3>{section}</h3>
        { controlGroups }
      </div>
    );
  }

  ControlInfo() {
    const sections = Object.keys(this.props.keyboardControls.controls).map(section =>
      this.ControlSection(section, this.props.keyboardControls.controls[section])
    );

    return (
      <div className="keyboard-control-info">
        { sections }
      </div>
    );
  }

  render() {
    return (
      <div className="header-icon keyboard-controls-icon">
        <ToolTip content={this.ControlInfo()} className="keyboard-controls-tooltip">
          <ImageIcon icon={KeyboardIcon} />
        </ToolTip>
      </div>
    );
  }
}

export default KeyboardControls;
