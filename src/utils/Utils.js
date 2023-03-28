import React from "react";

// onWheel is a passive event, which prevents disabling page scroll
// React doesn't support marking callbacks as active, so we can use `ref` to attach the handler directly to the element to prevent scrolling instead
export const StopScroll = ({shift=false}={}) => {
  return element => {
    if(!element) { return; }

    const Handler = event => {
      if((!shift && event.shiftKey) || shift && !event.shiftKey) { return; }

      event.preventDefault();
    };

    element.addEventListener("wheel", Handler, false);
  };
};

export const DownloadFromUrl = (url, filename, options={}) => {
  let element = document.createElement("a");
  element.href = url;
  element.download = filename;

  Object.keys(options).forEach(key => element[key] = options[key]);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
  window.URL.revokeObjectURL(url);
};

export const SortEntries = entries => entries.sort((a, b) => {
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

export const Input =
  props => (
    <input
      {...props}
      onKeyPress={event => {
        event.stopPropagation();

        if(props.onKeyPress) {
          props.onKeyPress(event);
        }
      }}
    />
  );

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
