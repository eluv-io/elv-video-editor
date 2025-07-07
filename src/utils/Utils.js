import SharedStyles from "@/assets/stylesheets/modules/shared.module.scss";
import {Utils} from "@eluvio/elv-client-js";
import {toJS} from "mobx";
import {useEffect, useState} from "react";

// toJS doesn't deeply remove proxies
export const Unproxy = obj => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch(error) {
    return toJS(obj);
  }
};

export const JoinClassNames = (...cs) => cs.map(c => c || "").join(" ");

export const CreateModuleClassMatcher = (...modules) => {
  modules = [...modules, SharedStyles];

  return (...classes) => JoinClassNames(
    ...(classes.map(c => {
      return modules
        .map(m => m?.[c])
        .filter(c => c)
        .join(" ");
    }))
  );
};

export const ValidEmail = email => {
  return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    .test(email);
};


export const TextWidth = ({text, fontWeight="normal", fontSize=16}) => {
  const canvas = window.__textWidthCanvas || (window.__textWidthCanvas = document.createElement("canvas"));

  const context = canvas.getContext("2d");

  const fontFamily = window.getComputedStyle(document.body, null).getPropertyValue("font-family");
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  return context.measureText(text).width;
};

export const FormatConfidence = confidence =>
  `${parseFloat((parseFloat(confidence) * 100).toFixed(1))}%`;

export const Round = (number, digits) => {
  return parseFloat(parseFloat(number).toFixed(digits));
};


// onWheel is a passive event, which prevents disabling page scroll
// React doesn't support marking callbacks as active, so we can use `ref` to attach the handler directly to the element to prevent scrolling instead
export const StopScroll = ({element, shift=false, control=false, meta=false}={}) => {
  if(!element) { return; }

  const Handler = event => {
    if(
      (shift && event.shiftKey) ||
      (control && event.ctrlKey) ||
      (meta && event.metaKey) ||
      (!shift && !control && !event.shiftKey && !event.ctrlKey && !event.metaKey)
    ) {
      event.preventDefault();
    }
  };

  element.addEventListener("wheel", Handler, false);
};

export const DownloadFromUrl = (url, filename, options={}) => {
  if(!url?.startsWith("data") && !url?.startsWith("blob")) {
    // Fabric URLs need their content disposition header set
    url = new URL(url);
    url.searchParams.set("header-x_set_content_disposition", `attachment; filename="${filename}"`);
  }

  let element = document.createElement("a");

  element.target = "_blank";
  element.href = url.toString();
  element.download = filename;

  Object.keys(options).forEach(key => element[key] = options[key]);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
  window.URL.revokeObjectURL(url);
};

export const SortTags = tags => tags.sort((a, b) => {
  a = {
    ...a,
    startTime: a.startTime || a.start_time,
    endTime: a.endTime || a.end_time,
  };

  b = {
    ...b,
    startTime: b.startTime || b.start_time,
    endTime: b.endTime || b.end_time,
  };


  if(a.startTime === b.startTime) {
    if(a.endTime === b.endTime) {
      return a.label < b.label ? -1 : 1;
    }

    return a.endTime < b.endTime ? -1 : 1;
  }

  return a.startTime < b.startTime ? -1 : 1;
});

// Traverse through a hashmap without throwing errors on undefined keys
// If any keys undefined, returns undefined
export const SafeTraverse = (object, ...keys) => {
  if(keys.length === 1 && Array.isArray(keys[0])) {
    keys = keys[0];
  }

  let result = object;

  for(let i = 0; i < keys.length; i++){
    result = result[keys[i]];

    if(result === undefined) { return undefined; }
  }

  return result;
};

export const SplitArray = (array, n) => {
  const arrays =  [...Array(n)].map(() => []);

  let i = 0;
  let a = 0;
  while(i < array.length) {
    arrays[a].push(array[i]);

    a = (a + 1) % n;
    i += 1;
  }

  return arrays;
};


export const Capitalize = (string) => {
  return string.replace(/_/g, " ").replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};


export const Copy = async (value) => {
  try {
    value = (value || "").toString();

    await navigator.clipboard.writeText(value);
  } catch(error) {
    const input = document.createElement("input");

    input.value = value;
    input.select();
    input.setSelectionRange(0, 99999);
    document.execCommand("copy");
  }
};

export const ConvertColor = ({hex, rgb, alpha}) => {
  if(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: alpha || 255
    } : null;
  } else {
    return `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`;
  }
};

export const Slugify = str =>
  (str || "")
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^a-z0-9-]/g,"")
    .replace(/-+/g, "_");

export const ScaleImage = (url, width) => {
  if(!url) { return ""; }

  if(url.includes(".svg")) {
    return url;
  }

  url = new URL(url);
  url.searchParams.set("width", width);

  return url.toString();
};

export const StorageHandler = ({
  get: ({type, key, json, b64}) => {
    try {
      const storage = type === "session" ? sessionStorage : localStorage;

      let value = storage.getItem(key);

      if(!value) { return; }

      if(b64) {
        value = Utils.FromB64(value);
      }

      if(json) {
        value = JSON.parse(value);
      }

      return value;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  },
  set: ({type, key, value, json, b64}) => {
    try {
      const storage = type === "session" ? sessionStorage : localStorage;

      if(json) {
        value = JSON.stringify(value);
      }

      if(b64) {
        value = Utils.B64(value);
      }

      storage.setItem(key, value);
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  },
  remove: ({type, key}) => {
    try {
      const storage = type === "session" ? sessionStorage : localStorage;

      storage.removeItem(key);
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  }
});

const emptyImage = new Image(1, 1);
emptyImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

export const DragHandler = fn => event => {
   // ...
  // If the image isn't complete, Safari will abort the drag.
  // Double check to be safe:
  event.dataTransfer.setDragImage(emptyImage, 0, 0);

  return fn(event);
};

// React hook to get if the component is currently visible
export const useIsVisible = (ref, unloadDelay=0) => {
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    if(!ref) { return; }

    let timeout;
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timeout);

      entry.isIntersecting ?
        setIntersecting(true) :
        timeout = setTimeout(() => setIntersecting(false), unloadDelay);
    });

    observer.observe(ref);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return isIntersecting;
};

export const CSVtoList = (v="") => {
  return v.trim().split(",").map(i => i.trim()).filter(i => i);
};

export const StripFabricLinkUrls = (metadata, depth=1) => {
  if(depth > 10) {
    return {};
  }

  if(Array.isArray(metadata)) {
    return metadata.map(item => StripFabricLinkUrls(item, depth + 1));
  } else if(typeof metadata === "object") {
    if(metadata["/"]) {
      return {
        "/": metadata["/"]
      };
    }

    let newMetadata = {};
    Object.keys(metadata).forEach(key =>
      newMetadata[key] = StripFabricLinkUrls(metadata[key], depth + 1)
    );

    return newMetadata;
  }

  return metadata;
};

// Stop propegation - useful in submenus of links
export const SP = fn =>
  fn?.constructor?.name === "AsyncFunction" ?
    async event => {
      event.stopPropagation();
      event.preventDefault();
      return fn?.(event);
    } :
    event => {
      event.stopPropagation();
      event.preventDefault();
      return fn?.(event);
    };
