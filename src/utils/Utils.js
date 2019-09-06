import React from "react";
import {inject, observer} from "mobx-react";

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

// Automatically disable and enable global keyboard controls when element is used
export const OverrideKeyboardControls = (keyboardProps) => ({
  onFocus: keyboardProps.DisableControls,
  onBlur: keyboardProps.EnableControls
});

export const Input = inject("keyboardControls")(observer(
  ({keyboardControls, ...props}) => (
    <input
      {...OverrideKeyboardControls(keyboardControls)}
      {...props}
    />
  )
));

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
