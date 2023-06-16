import React from "react";
import {IconButton, ToolTip} from "elv-components-js";
import BackIcon from "../static/icons/DoubleBackward.svg";

export const BackButton = ({onClick, className=""}) => {
  return (
    <IconButton
      label="Back"
      className={`back-button ${className || ""}`}
      icon={BackIcon}
      onClick={onClick}
    />
  );
};

export const Checkbox = ({value, onChange, toolTip, className="", size="xs"}) => {
  const checkbox = (
    <div className={`checkbox-container ${className || ""}`}>
      <div
        onClick={(event) => {
          event.stopPropagation();
          onChange(!value);
        }}
        className={`checkbox ${value ? "checked" : ""} checkbox-${size}`}
      />
    </div>
  );

  if(toolTip) {
    return (
      <ToolTip content={toolTip} >
        { checkbox }
      </ToolTip>
    );
  }

  return checkbox;
};

export const Radio = ({
  label="",
  value,
  checked,
  onChange,
  toolTip,
  className="",
  id,
  disabled
}) => {
  const radio = (
    <div className={`radio-container ${className || ""}`}>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onChange(value);
        }}
        id={id}
        type="button"
        role="radio"
        className="radio-button"
        disabled={disabled}
      >
        <span className={`radio ${checked ? "checked" : ""}`} />
      </button>
      <label htmlFor={id} className={disabled ? "label-disabled" : ""}>{ label }</label>
    </div>
  );

  if(toolTip) {
    return (
      <ToolTip content={toolTip}>
        { radio }
      </ToolTip>
    );
  }

  return radio;
};
