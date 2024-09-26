import CommonStyles from "Assets/stylesheets/modules/common.module.scss";

import React from "react";
import {CreateModuleClassMatcher, JoinClassNames} from "Utils/Utils";
import {Tooltip} from "@mantine/core";
import SVG from "react-inlinesvg";

const S = CreateModuleClassMatcher(CommonStyles);

// Loaders

export const BareLoader = ({className=""}) => (
  <div className={JoinClassNames(S("spinner"), className)}>
    <div className={S("spinner__inner")}/>
  </div>
);

export const Loader = ({className = "", loaderClassName=""}) => {
  return (
    <div className={JoinClassNames(S("loader"), className)}>
      <BareLoader className={loaderClassName}/>
    </div>
  );
};

// Buttons

export const IconButton = ({
  label,
  icon,
  active=false,
  tooltipProps={openDelay: 1000},
  unstyled=false,
  children,
  ...props
}) => {
  if(props.disabled) {
    props.onClick = undefined;
  }

  const button = (
    <button
      {...props}
      aria-label={label || ""}
      className={JoinClassNames(!unstyled && S("icon-button", active ? "icon-button--active" : ""), props.className || "")}
    >
      {
        typeof icon === "string" ?
          <SVG src={icon} /> :
          icon
      }
      { children }
    </button>
  );

  if(!label) {
    return button;
  }

  return (
    <Tooltip
      {...tooltipProps}
      withinPortal
      label={label}
      events={{ hover: true, focus: true, touch: false }}
    >
      { button }
    </Tooltip>
  );
};
