import CommonStyles from "@/assets/stylesheets/modules/common.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {CreateModuleClassMatcher, JoinClassNames, TextWidth} from "@/utils/Utils.js";
import {Select, Switch, TextInput, Tooltip} from "@mantine/core";
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
  tooltipProps={openDelay: 500},
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
      onChange={props.onChange}
      aria-label={props["aria-label"] || label || ""}
      {...props}
    />
  );

  if(label) {
    return (
      <Tooltip label={label} openDelay={500}>
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
    <Tooltip label={label} openDelay={500}>
      <Select
        data={options}
        classNames={{
          root: S("select"),
          input: S("select__input"),
          option: S("select__option")
        }}
        leftSectionWidth={0}
        rightSectionWidth={0}
        onChange={value => value && props?.onChange(value)}
        aria-label={props["aria-label"] || label || ""}
        {...props}
        w={textWidth || props.width}
        comboboxProps={{width: "max-content", ...(props.comboboxProps || {})}}
      />
    </Tooltip>
  );
});

export const SwitchInput = observer(({...props}) => {
  return (
    <Switch
      {...props}
      classNames={{
        root: S("switch"),
        thumb: S("switch__thumb"),
        label: S("switch__label"),
        track: S("switch__track"),
      }}
    />
  );
});

export const ResizeHandle = observer(({onMove, variant="both"}) => {
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef(null);

  useEffect(() => {
    if(!dragging) { return; }

    const Move = event => {
      const handlePosition = handleRef?.current?.getBoundingClientRect();

      if(!handlePosition) { return; }

      onMove({
        deltaX: event.clientX - (handlePosition.x + handlePosition.width),
        deltaY: event.clientY - (handlePosition.y - (handlePosition.height / 2))
      });
    };

    document.addEventListener("dragover", Move);

    return () => {
      document.removeEventListener("dragover", Move);
    };
  }, [dragging]);

  return (
    <div className={S("resize-handle", `resize-handle--${variant}`, dragging ? "resize-handle--active" : "")}>
      <div
        ref={handleRef}
        draggable
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}
        className={S("resize-handle__draggable")}
      />
    </div>
  );
});