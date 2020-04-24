import React from "react";
import {inject, observer} from "mobx-react";
import {IconButton, Modal} from "elv-components-js";
import ToolTip from "elv-components-js/src/components/Tooltip";
import CloseIcon from "../../static/icons/X.svg";
import KeyboardIcon from "../../static/icons/Keyboard.svg";

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
class KeyboardControlsModal extends React.Component {
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

    const labels = controls.map((control, i) =>
      <React.Fragment key={`keyboard-control-label-${control}`}>
        <label className="control-label">{control}</label>
        { i < controls.length - 1 ? <label className="control-label"> | </label> : null }
      </React.Fragment>
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

  render() {
    const sections = Object.keys(this.props.keyboardControls.controls).map(section =>
      this.ControlSection(section, this.props.keyboardControls.controls[section])
    );

    return (
      <div className="keyboard-control-info">
        <IconButton
          icon={CloseIcon}
          onClick={this.props.CloseModal}
          label="Close Keyboard Controls"
          className="close-button"
        />
        { sections }
      </div>
    );
  }
}

class KeyboardControls extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      modal: null,
      uploading: false
    };

    this.CloseModal = this.CloseModal.bind(this);
    this.ActivateModal = this.ActivateModal.bind(this);
  }

  ActivateModal() {
    this.setState({
      modal: (
        <Modal
          closable={true}
          OnClickOutside={this.CloseModal}
          className="keyboard-controls-modal"
        >
          <KeyboardControlsModal
            CloseModal={this.CloseModal}
          />
        </Modal>
      )
    });
  }

  CloseModal() {
    this.setState({modal: null});
  }

  render() {
    return (
      <React.Fragment>
        <ToolTip content={<span>Show Keyboard Controls</span>}>
          <IconButton
            onClick={this.ActivateModal}
            icon={KeyboardIcon}
            className="header-icon keyboard-controls-icon"
          />
        </ToolTip>
        { this.state.modal }
      </React.Fragment>
    );
  }
}

export default KeyboardControls;
