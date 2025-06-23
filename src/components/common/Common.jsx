import CommonStyles from "@/assets/stylesheets/modules/common.module.scss";

import React, {forwardRef, useEffect, useState} from "react";
import {ConvertColor, Copy, CreateModuleClassMatcher, JoinClassNames, TextWidth} from "@/utils/Utils.js";
import {
  Button,
  ColorInput,
  Modal as MantineModal, MultiSelect,
  NumberInput, Progress, RingProgress,
  Select,
  Switch,
  Textarea,
  TextInput,
  Tooltip
} from "@mantine/core";
import {DateTimePicker} from "@mantine/dates";
import SVG from "react-inlinesvg";
import {observer} from "mobx-react-lite";
import {Link} from "wouter";
import {keyboardControlsStore, videoStore} from "@/stores/index.js";
import {modals} from "@mantine/modals";

import CopyIcon from "@/assets/icons/v2/copy.svg";
import CheckIcon from "@/assets/icons/check-circle.svg";

const S = CreateModuleClassMatcher(CommonStyles);

// Loaders

export const BareLoader = ({className=""}) => (
  <div className={JoinClassNames(S("spinner"), className)}>
    <div className={S("spinner__inner")}/>
  </div>
);

export const Loader = ({className = "", loaderClassName="", ...props}) => {
  return (
    <div className={JoinClassNames(S("loader"), className)} {...props}>
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
  noAnimation,
  delay=25,
  loaderDelay=250,
  setRef,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
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

  if(error) {
    return (
      <object
        {...props}
        style={{
          ...(props.style || {}),
          ...(loaderWidth ? {width: loaderWidth} : {}),
          ...(loaderHeight ? {height: loaderHeight} : {}),
          ...(loaderAspectRatio ? {aspectRatio: loaderAspectRatio} : {})
        }}
        key={props.key ? `${props.key}--placeholder` : undefined}
        className={
          JoinClassNames(
            S(
              "lazy-image__background",
              showLoader ? "lazy-image__background--error" : "",
              noAnimation ? "" : "lazy-image__background--animated"
            ),
            props.className || ""
          )
        }
      />
    );
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
            className={JoinClassNames(S("lazy-image__loader-image"), props.className)}
            loading={lazy ? "lazy" : "eager"}
            src={(useAlternateSrc && alternateSrc) || src}
            onLoad={() => setTimeout(() => setLoaded(true), delay)}
            onError={() => {
              if(alternateSrc && !useAlternateSrc) {
                setUseAlternateSrc(true);
              } else {
                setError(true);
                setLoaded(true);
              }
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
            className={
              JoinClassNames(
                S(
                  "lazy-image__background",
                  showLoader ? "lazy-image__background--visible" : "",
                  noAnimation ? "" : "lazy-image__background--animated"
                ),
                props.className || ""
              )
            }
          />
      }
    </>
  );
});

export const LocalizeString = (text="", variables={}, options={reactNode: false}) => {
  let result = text
    .split(/{(\w+)}/)
    .filter(s => s)
    .map(token => typeof variables[token] !== "undefined" ? variables[token] : token);

  if(!options.reactNode) {
    return result.join("");
  }

  return (
    <>
      {result}
    </>
  );
};

// Buttons

export const Linkish = forwardRef(function Linkish({
  to,
  href,
  target="_blank",
  rel="noopener",
  onClick,
  disabled,
  styled=false,
  divButton=false,
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
    if(divButton) {
      return <div role="button" tabIndex={0} aria-disabled={disabled} onClick={!disabled ? onClick : undefined} ref={ref} {...props} />;
    } else {
      return <button disabled={disabled} onClick={onClick} ref={ref} {...props} />;
    }
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
  Icon,
  active=false,
  disabled=false,
  tooltipProps={},
  unstyled=false,
  loading=false,
  loadingProgress,
  children,
  openDelay=500,
  highlight,
  faded,
  small,
  withinPortal=true,
  noHover,
  ...props
}) => {
  const [submitting, setSubmitting] = useState(false);

  loading = loading || (loadingProgress > 0 && loadingProgress < 100);

  tooltipProps = {openDelay, ...tooltipProps};

  if(props.disabled) {
    props.onClick = undefined;
  }

  let content;
  if(loading || submitting) {
    if(loadingProgress) {
      content = (
        <RingProgress
          size={25}
          thickness={3}
          transitionDuration={500}
          rootColor="var(--text-tertiary)"
          sections={[{value: loadingProgress, color: "var(--color-highlight"}]}
        />
      );
    } else {
      content = <Loader className={S("icon-button__loader")}/>;
    }
  } else {
    content = (
      <>
        {
          Icon ? <Icon /> :
            typeof icon === "string" ?
              <SVG src={icon} /> :
              icon
        }
        { children }
      </>
    );
  }

  const button = (
    <Linkish
      {...props}
      disabled={disabled}
      aria-label={props["aria-label"] || label || ""}
      onClick={
        !props.onClick || loading || submitting ? undefined :
          async event => {
            const loadingTimeout = setTimeout(() => setSubmitting(true), 100);
            try {
              await props.onClick(event);
            } finally {
              clearTimeout(loadingTimeout);
              setSubmitting(false);
            }
          }
      }
      className={
        JoinClassNames(
          unstyled ? "" :
            S(
              "icon-button",
              active ? "icon-button--active" : "",
              disabled ? "icon-button--disabled" : "",
              faded ? "icon-button--faded" : "",
              highlight ? "icon-button--highlight" : "",
              small ? "icon-button--small" : "",
              noHover ? "icon-button--no-hover" : ""
            ),
          props.className || ""
        )
      }
    >
      { content }
    </Linkish>
  );

  if(!label) {
    return button;
  }

  return (
    <Tooltip
      {...tooltipProps}
      withinPortal={withinPortal}
      label={label}
      events={{ hover: true, focus: true, touch: false }}
    >
      { button }
    </Tooltip>
  );
};

let copyTimeout;
export const CopyButton = observer(({value, ...props}) => {
  const [copied, setCopied] = useState(false);

  return (
    <IconButton
      {...props}
      icon={!copied ? CopyIcon : CheckIcon}
      onClick={event => {
        event.stopPropagation();
        event.preventDefault();

        clearTimeout(copyTimeout);
        Copy(value);
        setCopied(true);

        copyTimeout = setTimeout(() => setCopied(false), 2000);
      }}
      className={
        JoinClassNames(
          S("copy-button", copied ? "copy-button--copied" : ""),
          props.className
        )
      }
    />
  );
});

export const CopyableField = observer(({value, children, buttonProps={}, showOnHover=false, className="", ...props}) => {
  return (
    <div {...props} className={JoinClassNames(S("copyable-field", showOnHover ? "copyable-field--show-hover" : ""), className)}>
      <div className={S("copyable-field__value", "ellipsis")}>
        { children || value }
      </div>
      <CopyButton
        {...buttonProps}
        value={value}
        className={JoinClassNames(S("copyable-field__button", "ellipsis"), buttonProps.className)}
      />
    </div>
  );
});

export const AsyncButton = observer(({onClick, tooltip, ...props}) => {
  const [loading, setLoading] = useState(false);

  let button = (
    <Button
      {...props}
      loading={loading}
      onClick={async event => {
        setLoading(true);

        try {
          await onClick?.(event);
        } finally {
          setLoading(false);
        }
      }}
    />
  );

  if(!tooltip) {
    return button;
  }

  return (
    <Tooltip label={tooltip}>
      { button }
    </Tooltip>
  );
});

export const StyledButton = observer(({icon, variant="primary", color="--color-highlight", children, ...props}) => {
  return (
    <Linkish
      {...props}
      style={{
        ...(props.style || {}),
        "--button-color": `var(${color})`
      }}
      className={S("styled-button", `styled-button--${variant}`)}
    >
      {
        !icon ? null :
          <div className={S("styled-button__icon-container")}>
            <Icon icon={icon} className={S("styled-button__icon")} />
          </div>
      }
      <div className={S("styled-button__children")}>
        { children }
      </div>
    </Linkish>
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

export const FormNumberInput = observer(props =>
  <NumberInput
    min={0}
    max={100}
    {...props}
    classNames={{
      root: S("form-input"),
      label: S("form-input__label"),
      input: S("form-input__input")
    }}
  />
);

export const FormTextArea = observer(props =>
  <Textarea
    autosize
    maxRows={props.maxRows || 10}
    minRows={props.minRows || 3}
    resize="vertical"
    {...props}
    classNames={{
      root: S("form-input"),
      label: S("form-input__label", "form-input__label--textarea", props.disabled ? "form-input__label--textarea-disabled" : ""),
      input: S("form-input__input", "form-input__textarea")
    }}
  />
);

// Form styled inputs
export const FormDateTimeInput = observer(props =>
  <DateTimePicker
    {...props}
    classNames={{
      root: S("form-input"),
      label: S("form-input__label"),
      input: S("form-input__input")
    }}
  />
);

export const FormColorInput = observer(props => {
  // Display in hex, value in rgba
  const [hexValue, setHexValue] = useState(ConvertColor({rgb: props.value}));

  useEffect(() => {
    try {
      const convertedColor = ConvertColor({hex: hexValue});

      if(convertedColor) {
        props.onChange(ConvertColor({hex: hexValue}));
      }
    } catch(error) { /* empty */ }
  }, [hexValue]);

  return (
    <ColorInput
      {...props}
      value={hexValue}
      onChange={setHexValue}
      classNames={{
        root: S("form-input"),
        label: S("form-input__label"),
        input: S("form-input__input"),
        section: S("form-input__color-section"),
        colorPreview: S("form-input__color-preview")
      }}
    />
  );
});

export const FormSelect = observer(props =>
  <Select
    {...props}
    allowDeselect={false}
    data={props.options || props.data}
    classNames={{
      root: S("form-input"),
      label: S("form-input__label"),
      input: S("form-input__input")
    }}
  />
);

export const FormMultiSelect = observer(props =>
  <MultiSelect
    {...props}
    data={props.options || props.data}
    classNames={{
      root: S("form-input"),
      label: S("form-input__label"),
      input: S("form-input__input", "form-input__multiselect")
    }}
  />
);

export const SMPTEInput = observer(({store, value, onChange, formInput=false, highlight,  ...props}) => {
  const [smpteInput, setSMPTEInput] = useState(value);

  const FormatSMPTE = ({originalValue, smpte, setSMPTEInput}) => {
    store = store || videoStore;

    try {
      const frame = store.SMPTEToFrame(smpte);

      return { frame, smpte };
    } catch(error) {
      setSMPTEInput(originalValue);
      return { frame: store.SMPTEToFrame(originalValue) , smpte: originalValue };
    }
};

  let Component = formInput ? FormTextInput : Input;

  useEffect(() => {
    setSMPTEInput(value);
  }, [value]);

  return (
    <Component
      value={smpteInput}
      monospace
      onChange={event => setSMPTEInput(event.target.value)}
      onKeyDown={event => {
        if(event.key === "Enter") {
          onChange?.(FormatSMPTE({originalValue: value, smpte: smpteInput, setSMPTEInput}));
        } else if(event.key === "ArrowUp") {
          const { frame } = FormatSMPTE({originalValue: value, smpte: smpteInput, setSMPTEInput});
          const newSMPTE = store.FrameToSMPTE(Math.min(frame + 1, store.totalFrames));
          onChange?.(FormatSMPTE({originalValue: value, smpte: newSMPTE, setSMPTEInput}));
        } else if(event.key === "ArrowDown") {
          const { frame } = FormatSMPTE({originalValue: value, smpte: smpteInput, setSMPTEInput});
          const newSMPTE = store.FrameToSMPTE(Math.max(frame - 1, 0));
          onChange?.(FormatSMPTE({originalValue: value, smpte: newSMPTE, setSMPTEInput}));
        }
      }}
      onBlur={() => onChange?.(FormatSMPTE({originalValue: value, smpte: smpteInput, setSMPTEInput}))}
      className={JoinClassNames(S("smpte-input", highlight ? "input--highlight" : ""), props.className)}
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

export const Modal = observer(({alwaysOpened, ...props}) => {
  const [opened, setOpened] = useState(props.opened);

  useEffect(() => {
    if(alwaysOpened) {
      // Show open effect even if it was newly created
      setTimeout(() => setOpened(true), 0);
    }
  }, []);

  // Disable keyboard controls when modal is opened
  useEffect(() => {
    if(!props.opened) { return; }

    const controlsOriginallyEnabled = keyboardControlsStore.keyboardControlsEnabled;

    keyboardControlsStore.ToggleKeyboardControls(false);

    return () => keyboardControlsStore.ToggleKeyboardControls(controlsOriginallyEnabled);
  }, [props.opened]);

  return <MantineModal opened={props.opened || opened} {...props} />;
});

export const ClipTimeInfo = observer(({store, clipInFrame, clipOutFrame, className=""}) => {
  if(!store) { return null; }

  clipInFrame = clipInFrame || 0;
  clipOutFrame = clipOutFrame || store.totalFrames - 1;

  return (
    <div className={JoinClassNames(S("clip-time"), className)}>
      <span>
        {store.videoHandler.FrameToSMPTE(clipInFrame)}
      </span>
      <span>-</span>
      <span>
        {store.videoHandler.FrameToSMPTE(clipOutFrame)}
      </span>
      <span>
        ({store.videoHandler.FrameToString({frame: clipOutFrame - clipInFrame})})
      </span>
    </div>
  );
});

let cancelTimeout;
export const Confirm = async ({title, text, labels={}, onConfirm, onCancel}) => {
  if(!await new Promise(resolve => {
    const Title = () => {
      // For some reason, closing the modal any way except the cancel button *doesn't* call onCancel
      // Detect when one of the components is unrendered to ensure the promise is resolved
      useEffect(() => {
        clearTimeout(cancelTimeout);

        return () => {
          cancelTimeout = setTimeout(() => resolve(false), 100);
        };
      }, []);

      return <div className={S("confirm__title")}>{title || "Confirm"}</div>;
    };

    modals.openConfirmModal({
      size: 500,
      title: <Title />,
      centered: true,
      withCloseButton: false,
      children: <div className={S("confirm__text")}>{text}</div>,
      labels: {confirm: labels.confirm || "Confirm", cancel: labels.cancel || "Cancel"},
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  })) {
    await onCancel?.();
    return;
  }

  await onConfirm();
};

export const ProgressModal = observer(({progress, title}) => {
  // Last 5% is reserved for finalizing
  return (
    <Modal
      title={title}
      alwaysOpened
      centered
      onClose={() => {}}
      withCloseButton={false}
    >
      <div className={S("progress")}>
        <Progress
          value={progress}
          max={100}
          transitionDuration={1000}
          mb="md"
        />
      </div>
    </Modal>
  );
});
