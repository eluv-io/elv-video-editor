import KeyboardControlsStyles from "@/assets/stylesheets/modules/keyboard-controls.module.scss";
import React, {useState} from "react";
import {observer} from "mobx-react";
import {Modal} from "@mantine/core";
import {Icon, IconButton} from "@/components/common/Common.jsx";
import {keyboardControlsStore} from "@/stores/index.js";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

import KeyboardIcon from "@/assets/icons/v2/keyboard.svg";
import CommandIcon from "@/assets/icons/v2/command.svg";
import ShiftIcon from "@/assets/icons/v2/shift.svg";
import ControlIcon from "@/assets/icons/chevron-up.svg";

const S = CreateModuleClassMatcher(KeyboardControlsStyles);

const modifierIcons = {
  metaAction: CommandIcon,
  shiftAction: ShiftIcon,
  controlAction: ControlIcon
};

const Control = ({control}) => {
  const actions = control?.[1];
  const keys =
    actions.keyLabel ||
    control[0]
      .map(key => {
        switch(key.toUpperCase()) {
          case " ":
            return "Space";
          case "ARROWUP":
            return "↑";
          case "ARROWRIGHT":
            return "→";
          case "ARROWDOWN":
            return "↓";
          case "ARROWLEFT":
            return "←";
          default:
            return key.toUpperCase();
        }
      })
      .join(", ");

  return (
    Object.keys(actions).map(actionKey =>
      !["action", "shiftAction", "altAction", "controlAction", "metaAction"].includes(actionKey) ? null :
        <div key={actionKey} className={S("control")}>
          <div className={S("control__action")}>
            {actions[actionKey].description}
          </div>
          <div className={S("control__keys")}>
            {
              modifierIcons[actionKey] ?
                <Icon icon={modifierIcons[actionKey]} className={S("control__icon")} /> :
                actionKey === "altAction" ?
                  <span>Alt +</span> : null
            }
            { keys }
          </div>
        </div>
    )
  );
};

const KeyboardControlGroup = observer(({title, controls}) => {
  return (
    <div className={S("controls-group")}>
      <h2 className={S("controls-group__title")}>
        { title }
      </h2>

      { controls.map(control => <Control key={control[0]} control={control} />) }
    </div>
  );
});

const KeyboardControlsModal = observer((props) => {
  return (
    <Modal
      size={1200}
      centered
      {...props}
      classNames={{
        header: S("controls-modal__header"),
        body: S("controls-modal__body"),
      }}
    >
      <div className={S("controls-row")}>
        <KeyboardControlGroup title="Playback" controls={keyboardControlsStore.controls.Playback}/>
        <div className={S("controls-row__separator")}/>
        <KeyboardControlGroup title="Volume" controls={keyboardControlsStore.controls.Volume}/>
        <div className={S("controls-row__separator")}/>
        <KeyboardControlGroup title="Seek" controls={keyboardControlsStore.controls.Seeking}/>
      </div>
      <div className={S("controls-row")}>
        <KeyboardControlGroup title="Timeline" controls={keyboardControlsStore.controls.Tracks}/>
        <div className={S("controls-row__separator")}/>
        <KeyboardControlGroup title="Clips" controls={keyboardControlsStore.controls.Clips}/>
        <div className={S("controls-row__separator")}/>
        <KeyboardControlGroup title="General" controls={keyboardControlsStore.controls.Editing}/>
      </div>
    </Modal>
  );
});

const KeyboardControls = observer(() => {
  const [showControls, setShowControls] = useState(false);
  return (
    <>
      <IconButton
        disabled={!keyboardControlsStore.keyboardControlsActive}
        icon={KeyboardIcon}
        label="Keyboard Shortcuts"
        onClick={() => setShowControls(true)}
      />
      <KeyboardControlsModal
        opened={showControls}
        onClose={() => setShowControls(false)}
      />
    </>
  );
});

export default KeyboardControls;
