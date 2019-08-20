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

export const Checkbox = ({value, onChange, toolTip, className=""}) => {
  const checkbox = (
    <div className={`checkbox-container ${className || ""}`}>
      <div
        onClick={(event) => {
          event.stopPropagation();
          onChange(!value);
        }}
        className={`checkbox ${value ? "checked" : ""}`}
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
