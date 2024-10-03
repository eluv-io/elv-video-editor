import CommonStyles from "Assets/stylesheets/modules/common.module.scss";

import React from "react";
import {CreateModuleClassMatcher, JoinClassNames, TextWidth} from "Utils/Utils";
import {Select, TextInput, Tooltip} from "@mantine/core";
import SVG from "react-inlinesvg";
import {observer} from "mobx-react";

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

export const Input = observer(({label, monospace, ...props}) => {
  const input = (
    <TextInput
      classNames={{
        root: S("input", monospace ? "monospace" : ""),
        input: S("input__input")
      }}
      textAlign="center"
      onChange={props.onChange}
      aria-label={props["aria-label"] || label || ""}
      {...props}
    />
  );

  if(label) {
    return (
      <Tooltip label={label} openDelay={1000}>
        { input }
      </Tooltip>
    );
  }

  return input;
});

export const SelectInput = observer(({label, options=[], autoWidth=true, ...props}) => {
  let textWidth;
  if(autoWidth) {
    const selectedOption = options.find(option =>
      (typeof option === "object" ? option.value : option)?.toString()  === props?.value?.toString()
    );
    textWidth = TextWidth({
      text: selectedOption?.label || selectedOption || "",
      fontSize: 16
    }) + 10;
  }

  return (
    <Tooltip label={label} openDelay={1000}>
      <Select
        data={options}
        classNames={{
          root: S("select"),
          input: S("select__input"),
          option: S("select__option")
        }}
        leftSectionWidth={0}
        rightSectionWidth={0}
        textAlign="center"
        onChange={value => value && props?.onChange(value)}
        aria-label={props["aria-label"] || label || ""}
        {...props}
        w={textWidth || props.width}
        comboboxProps={{width: "max-content", ...(props.comboboxProps || {})}}
      />
    </Tooltip>
  );
});
