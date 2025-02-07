import CommonStyles from "@/assets/stylesheets/modules/common.module.scss";

import React, {forwardRef, useEffect, useRef, useState} from "react";
import {CreateModuleClassMatcher, JoinClassNames, TextWidth} from "@/utils/Utils.js";
import {Button, Modal as MantineModal, Select, Switch, TextInput, Tooltip} from "@mantine/core";
import SVG from "react-inlinesvg";
import {observer} from "mobx-react";
import {Link} from "wouter";
import {keyboardControlsStore, videoStore} from "@/stores/index.js";

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

export const LoaderImage = observer(({
  src,
  alternateSrc,
  width,
  loaderHeight,
  loaderWidth,
  loaderAspectRatio,
  lazy=true,
  showWithoutSource=false,
  delay=25,
  loaderDelay=250,
  setRef,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [useAlternateSrc, setUseAlternateSrc] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setShowLoader(false);

    setTimeout(() => setShowLoader(true), loaderDelay);
  }, []);

  if(!src && !showWithoutSource) {
    return null;
  }

  if(width) {
    try {
      const url = new URL(src);
      url.searchParams.set("width", width);
      src = url.toString();
    } catch(error) { /* empty */ }
  }

  if(loaded) {
    return <img ref={setRef} src={(useAlternateSrc && src) || src} {...props} />;
  }

  return (
    <>
      {
        !src ? null :
          <img
            {...props}
            key={`img-${src}-${props.key || ""}`}
            className={S("lazy-image__loader-image") + " " + props.className}
            loading={lazy ? "lazy" : "eager"}
            src={(useAlternateSrc && alternateSrc) || src}
            onLoad={() => setTimeout(() => setLoaded(true), delay)}
            onError={() => {
              setUseAlternateSrc(true);
            }}
          />
      }
      {
        loaded ? null :
          <object
            {...props}
            style={{
              ...(props.style || {}),
              ...(loaderWidth ? {width: loaderWidth} : {}),
              ...(loaderHeight ? {height: loaderHeight} : {}),
              ...(loaderAspectRatio ? {aspectRatio: loaderAspectRatio} : {})
            }}
            key={props.key ? `${props.key}--placeholder` : undefined}
            className={[S("lazy-image__background", showLoader ? "lazy-image__background--visible" : ""), props.className || ""].join(" ")}
          />
      }
    </>
  );
});

// Buttons

export const Linkish = forwardRef(function Linkish({
  to,
  href,
  target="_blank",
  rel="noopener",
  onClick,
  disabled,
  styled=false,
  ...props
}, ref) {
  if(styled) {
    props.className = JoinClassNames("button", props.className || "");
  }

  if(!disabled) {
    // a tags don't have :disabled
    if(href) {
      return <a href={href} target={target} rel={rel} onClick={onClick} ref={ref} {...props} />;
    } else if(to) {
      return <Link href={to} onClick={onClick} ref={ref} {...props} />;
    }
  }

  if(onClick || props.type === "submit") {
    return <button onClick={onClick} ref={ref} {...props} />;
  }

  return <div ref={ref} {...props} />;
});

export const Icon = ({
  icon,
  ...props
}) => {
  return <SVG {...props} src={icon} />;
};

export const IconButton = ({
  label,
  icon,
  active=false,
  disabled=false,
  tooltipProps={openDelay: 500},
  unstyled=false,
  children,
  ...props
}) => {
  if(props.disabled) {
    props.onClick = undefined;
  }

  const button = (
    <Linkish
      {...props}
      disabled={disabled}
      aria-label={label || ""}
      className={
        JoinClassNames(
          !unstyled && S("icon-button", active ? "icon-button--active" : ""),
          !unstyled && S("icon-button", disabled ? "icon-button--disabled" : ""),
          props.className || ""
        )
      }
    >
      {
        typeof icon === "string" ?
          <SVG src={icon} /> :
          icon
      }
      { children }
    </Linkish>
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

export const AsyncButton = observer(({onClick, ...props}) => {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      {...props}
      loading={loading}
      onClick={async event => {
        setLoading(true);

        try {
          await onClick(event);
        } finally {
          setLoading(false);
        }
      }}
    />
  );
});

export const Input = observer(({label, monospace, rightIcon, ...props}) => {
  const input = (
    <TextInput
      classNames={{
        root: S("input", monospace ? "monospace" : ""),
        input: S("input__input")
      }}
      onChange={props.onChange}
      aria-label={props["aria-label"] || label || ""}
      rightSection={!rightIcon ? null : <Icon icon={rightIcon} className={S("input__icon", "input__icon--right")} />}
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

// Form styled inputs
export const FormTextInput = observer(props =>
  <TextInput
    {...props}
    classNames={{
      root: S("form-input"),
      label: S("form-input__label"),
      input: S("form-input__input")
    }}
  />
);

export const FormSelect = observer(props =>
  <Select
    {...props}
    data={props.options || props.data}
    classNames={{
      root: S("form-input"),
      label: S("form-input__label"),
      input: S("form-input__input")
    }}
  />
);

const FormatSMPTE = ({originalValue, smpte, setSMPTEInput}) => {
  try {
    const frame = videoStore.SMPTEToFrame(smpte);

    return { frame, smpte };
  } catch(error) {
    setSMPTEInput(originalValue);
    return { frame: videoStore.SMPTEToFrame(originalValue) , smpte: originalValue };
  }
};

export const SMPTEInput = observer(({value, onChange, ...props}) => {
  const [smpteInput, setSMPTEInput] = useState(value);

  useEffect(() => {
    setSMPTEInput(value);
  }, [value]);

  return (
    <Input
      w={150}
      value={smpteInput}
      monospace
      onChange={event => setSMPTEInput(event.target.value)}
      onKeyDown={event => {
        if(event.key === "Enter") {
          onChange?.(FormatSMPTE({originalValue: value, smpte: smpteInput, setSMPTEInput}));
        } else if(event.key === "ArrowUp") {
          const { frame } = FormatSMPTE({originalValue: value, smpte: smpteInput, setSMPTEInput});
          const newSMPTE = videoStore.FrameToSMPTE(Math.min(frame + 1, videoStore.totalFrames));
          onChange?.(FormatSMPTE({originalValue: value, smpte: newSMPTE, setSMPTEInput}));
        } else if(event.key === "ArrowDown") {
          const { frame } = FormatSMPTE({originalValue: value, smpte: smpteInput, setSMPTEInput});
          const newSMPTE = videoStore.FrameToSMPTE(Math.max(frame - 1, 0));
          onChange?.(FormatSMPTE({originalValue: value, smpte: newSMPTE, setSMPTEInput}));
        }
      }}
      onBlur={() => onChange?.(FormatSMPTE({originalValue: value, smpte: smpteInput, setSMPTEInput}))}
      className={JoinClassNames(S("smpte-input", props.className))}
      {...props}
    />
  );
});

export const SwitchInput = observer(({...props}) => {
  return (
    <Switch
      {...props}
      color="var(--background-switch-active)"
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

export const Modal = observer((props) => {
  // Disable keyboard controls when modal is opened
  useEffect(() => {
    if(!props.opened) { return; }

    const controlsOriginallyEnabled = keyboardControlsStore.keyboardControlsEnabled;

    keyboardControlsStore.ToggleKeyboardControls(false);

    return () => keyboardControlsStore.ToggleKeyboardControls(controlsOriginallyEnabled);
  }, [props.opened]);

  return <MantineModal {...props} />;
});
